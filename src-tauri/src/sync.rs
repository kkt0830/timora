//! Durable delivery, acknowledgements and incoming changes. No network or tokens.
use super::*;

fn key(record: &Value, cloud_id: &str) -> Result<(String, String)> {
    if text(record, "user_id")? != cloud_id { return Err("다른 계정의 동기화 응답은 적용할 수 없습니다.".into()); }
    let table = text(record, "entity_table")?;
    if table != "workspace_settings" { fields(table)?; }
    let id = text(record, "id")?;
    Uuid::parse_str(id).map_err(|_| "동기화 항목 ID 오류")?;
    text(record, "revision")?.parse::<u64>().map_err(|_| "동기화 버전 오류")?;
    if !record["deleted"].is_boolean() { return Err("동기화 삭제 정보 오류".into()); }
    if record["deleted"] == false && text(&record["payload"], "user_id")? != cloud_id { return Err("동기화 소유자 오류".into()); }
    if table == "workspace_settings" && id != cloud_id { return Err("동기화 설정 소유자 오류".into()); }
    Ok((table.into(), if table == "workspace_settings" { "settings".into() } else { id.into() }))
}
fn meta(conn: &Connection, table: &str, id: &str, record: &Value) -> Result<()> {
    conn.execute("INSERT INTO native_sync_meta(entity_table,id,revision,remote_updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(entity_table,id) DO UPDATE SET revision=excluded.revision,remote_updated_at=excluded.remote_updated_at", params![table,id,text(record,"revision")?,record["payload"]["updated_at"].as_str()]).map_err(sql_error)?;
    Ok(())
}
fn conflict(conn: &Connection, table: &str, id: &str, record: &Value) -> Result<()> {
    conn.execute("INSERT INTO native_sync_conflicts VALUES(?1,?2,?3) ON CONFLICT(entity_table,id) DO UPDATE SET remote=excluded.remote", params![table,id,record.to_string()]).map_err(sql_error)?;
    Ok(())
}
fn local_row(conn: &Connection, table: &str, id: &str) -> Result<Value> {
    let rows = if table == "workspace_settings" { json_rows(conn,"SELECT * FROM workspace_settings", &[])? }
    else { fields(table)?; json_rows(conn,&format!("SELECT * FROM {table} WHERE id=?"), &[SqlValue::Text(id.into())])? };
    Ok(rows.into_iter().next().unwrap_or(Value::Null))
}
fn pending(conn: &Connection, table: &str, id: &str) -> Result<bool> {
    conn.query_row("SELECT EXISTS(SELECT 1 FROM native_sync_outbox WHERE entity_table=?1 AND id=?2)",params![table,id],|r|r.get(0)).map_err(sql_error)
}
fn rebase(conn: &Connection, table: &str, id: &str, record: &Value) -> Result<()> {
    conn.execute("UPDATE native_sync_outbox SET base_revision=?1,base_updated_at=?2 WHERE entity_table=?3 AND id=?4",params![text(record,"revision")?,record["payload"]["updated_at"].as_str(),table,id]).map_err(sql_error)?;
    Ok(())
}

impl Database {
    fn sync_owner(&self, cloud_id: &str) -> Result<String> {
        self.require_workspace()?;
        let identity=self.identity()?;
        if identity["access_state"]!="signed_in" || identity["cloud_user_id"].as_str()!=Some(cloud_id) { return Err("연결한 계정으로 Cloud 인증이 필요합니다. 로컬 기록은 보존됩니다.".into()); }
        self.owner()
    }
    pub fn sync_status(&self) -> Result<Value> {
        self.require_workspace()?;
        let pending:i64=self.conn.query_row("SELECT count(*) FROM native_sync_outbox",[],|r|r.get(0)).map_err(sql_error)?;
        let count:i64=self.conn.query_row("SELECT count(*) FROM native_sync_conflicts",[],|r|r.get(0)).map_err(sql_error)?;
        let mut conflicts=Vec::new();
        for mut item in json_rows(&self.conn,"SELECT entity_table,id,remote FROM native_sync_conflicts ORDER BY entity_table,id",&[])? {
            item["remote"]=serde_json::from_str(text(&item,"remote")?).map_err(|_|"동기화 충돌 응답 오류")?;
            item["local"]=local_row(&self.conn,text(&item,"entity_table")?,text(&item,"id")?)?;
            conflicts.push(item);
        }
        let control=json_rows(&self.conn,"SELECT cursor,last_success FROM native_sync_control WHERE singleton=1",&[])?.remove(0);
        Ok(json!({"pending":pending,"conflicts":conflicts,"conflict_count":count,"cursor":control["cursor"],"last_success":control["last_success"]}))
    }
    pub fn sync_next(&self, cloud_id: &str) -> Result<Value> {
        self.sync_owner(cloud_id)?;
        let mut rows=json_rows(&self.conn,"SELECT operation_id,entity_table,id,action,payload,base_revision,base_updated_at FROM native_sync_outbox o WHERE NOT EXISTS(SELECT 1 FROM native_sync_conflicts c WHERE c.entity_table=o.entity_table AND c.id=o.id) AND NOT EXISTS(SELECT 1 FROM native_sync_conflicts c WHERE c.entity_table='projects' AND c.id=json_extract(o.payload,'$.project_id')) ORDER BY seq LIMIT 1",&[])?;
        let Some(mut row)=rows.pop() else { return Ok(Value::Null); };
        row["payload"]=match row["payload"].as_str() { Some(s)=>serde_json::from_str(s).map_err(|_|"동기화 큐 형식 오류")?,None=>Value::Null };
        Ok(row)
    }
    fn apply_remote(conn: &Connection, owner: &str, cloud_id: &str, record: &Value, force: bool) -> Result<()> {
        let (table,id)=key(record,cloud_id)?;
        if !force {
            let known:Option<String>=conn.query_row("SELECT revision FROM native_sync_meta WHERE entity_table=?1 AND id=?2",params![table,id],|r|r.get(0)).ok().flatten();
            if known.as_deref().and_then(|v|v.parse::<u64>().ok()).is_some_and(|v|v>=text(record,"revision").unwrap_or("0").parse::<u64>().unwrap_or(0)) { return Ok(()); }
            if pending(conn,&table,&id)? {
                let base:Option<String>=conn.query_row("SELECT base_updated_at FROM native_sync_outbox WHERE entity_table=?1 AND id=?2 ORDER BY seq LIMIT 1",params![table,id],|r|r.get(0)).map_err(sql_error)?;
                let same=base.as_deref().zip(record["payload"]["updated_at"].as_str()).is_some_and(|(a,b)|instant(a).ok().zip(instant(b).ok()).is_some_and(|(a,b)|a==b));
                if same { meta(conn,&table,&id,record)?; rebase(conn,&table,&id,record)?; }
                else { conflict(conn,&table,&id,record)?; }
                return Ok(());
            }
            if table=="projects" && record["deleted"]==true {
                let dirty:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM native_sync_outbox WHERE json_extract(payload,'$.project_id')=?1)",[&id],|r|r.get(0)).map_err(sql_error)?;
                if dirty { conflict(conn,&table,&id,record)?; return Ok(()); }
            }
        }
        if record["deleted"]==true {
            if table!="workspace_settings" {
                conn.execute(&format!("DELETE FROM {table} WHERE id=?1"),[&id]).map_err(sql_error)?;
                // Choosing a deleted project also removes its link from queued child edits.
                // Rotate operation IDs because an earlier payload may already have a receipt.
                if table=="projects" && force {
                    conn.execute("UPDATE native_sync_outbox SET payload=json_set(payload,'$.project_id',NULL),operation_id=lower(printf('%s-%s-%s-%s-%s',hex(randomblob(4)),hex(randomblob(2)),hex(randomblob(2)),hex(randomblob(2)),hex(randomblob(6)))) WHERE json_extract(payload,'$.project_id')=?1",[&id]).map_err(sql_error)?;
                }
            }
        } else if table=="workspace_settings" {
            Self::settings(conn,owner,&record["payload"],true)?;
        } else {
            let payload=&record["payload"];
            if let Some(project)=payload["project_id"].as_str() {
                let exists:bool=conn.query_row("SELECT EXISTS(SELECT 1 FROM projects WHERE id=?1)",[project],|r|r.get(0)).map_err(sql_error)?;
                if !exists { if force { return Err("먼저 연결된 Project의 충돌을 해결해 주세요.".into()); } conflict(conn,&table,&id,record)?; return Ok(()); }
            }
            instant(text(payload,"created_at")?)?; instant(text(payload,"updated_at")?)?;
            let update=!local_row(conn,&table,&id)?.is_null();
            Self::write(conn,owner,&table,payload,&id,update,true)?;
            conn.execute(&format!("UPDATE {table} SET remote_updated_at=?1,sync_state='imported' WHERE id=?2"),params![text(payload,"updated_at")?,id]).map_err(sql_error)?;
        }
        meta(conn,&table,&id,record)?;
        Ok(())
    }
    pub fn sync_ack(&mut self, cloud_id: &str, operation_id: &str, response: Value) -> Result<()> {
        let owner=self.sync_owner(cloud_id)?;
        let record=&response["record"]; let (table,id)=key(record,cloud_id)?;
        let tx=self.conn.transaction().map_err(sql_error)?;
        let row=json_rows(&tx,"SELECT entity_table,id FROM native_sync_outbox WHERE operation_id=?",&[SqlValue::Text(operation_id.into())])?.into_iter().next();
        let Some(row)=row else { return Ok(()); }; // A deliberate conflict resolution replaced this delivery.
        if row["entity_table"]!=table || row["id"]!=id { return Err("동기화 응답 대상이 일치하지 않습니다.".into()); }
        match response["status"].as_str() {
            Some("conflict")=>conflict(&tx,&table,&id,record)?,
            Some("applied")=>{
                tx.execute("UPDATE native_sync_control SET applying=1",[]).map_err(sql_error)?;
                tx.execute("DELETE FROM native_sync_outbox WHERE operation_id=?1",[operation_id]).map_err(sql_error)?;
                meta(&tx,&table,&id,record)?; rebase(&tx,&table,&id,record)?;
                if !pending(&tx,&table,&id)? { Self::apply_remote(&tx,&owner,cloud_id,record,true)?; }
                tx.execute("DELETE FROM tombstones WHERE entity_table=?1 AND id=?2",params![table,id]).map_err(sql_error)?;
                tx.execute("UPDATE native_sync_control SET applying=0",[]).map_err(sql_error)?;
            },
            _=>return Err("동기화 서버 응답 오류".into()),
        }
        tx.commit().map_err(sql_error)
    }
    pub fn sync_page(&mut self, cloud_id: &str, after: &str, page: Value) -> Result<bool> {
        let owner=self.sync_owner(cloud_id)?;
        let tx=self.conn.transaction().map_err(sql_error)?;
        let cursor:String=tx.query_row("SELECT cursor FROM native_sync_control",[],|r|r.get(0)).map_err(sql_error)?;
        if cursor!=after { return Ok(false); }
        let next=text(&page,"cursor")?; let previous=cursor.parse::<u64>().map_err(|_|"동기화 cursor 오류")?;
        if next.parse::<u64>().map_err(|_|"동기화 cursor 오류")?<previous { return Err("동기화 cursor가 역행했습니다.".into()); }
        tx.execute("UPDATE native_sync_control SET applying=1",[]).map_err(sql_error)?;
        for list in ["dependencies","records"] {
            for record in page[list].as_array().ok_or("동기화 목록 응답 오류")? { Self::apply_remote(&tx,&owner,cloud_id,record,false)?; }
        }
        tx.execute("UPDATE native_sync_control SET applying=0,cursor=?1,last_success=?2",params![next,now()]).map_err(sql_error)?;
        tx.commit().map_err(sql_error)?;
        Ok(true)
    }
    pub fn sync_resolve(&mut self, cloud_id: &str, table: &str, id: &str, choice: &str) -> Result<()> {
        let owner=self.sync_owner(cloud_id)?;
        let tx=self.conn.transaction().map_err(sql_error)?;
        let encoded:String=tx.query_row("SELECT remote FROM native_sync_conflicts WHERE entity_table=?1 AND id=?2",params![table,id],|r|r.get(0)).map_err(sql_error)?;
        let record:Value=serde_json::from_str(&encoded).map_err(|_|"충돌 응답 오류")?;
        if key(&record,cloud_id)?!=(table.into(),id.into()) { return Err("충돌 대상 오류".into()); }
        let local=local_row(&tx,table,id)?;
        tx.execute("UPDATE native_sync_control SET applying=1",[]).map_err(sql_error)?;
        tx.execute("DELETE FROM native_sync_outbox WHERE entity_table=?1 AND id=?2",params![table,id]).map_err(sql_error)?;
        meta(&tx,table,id,&record)?;
        match choice {
            "cloud"=>Self::apply_remote(&tx,&owner,cloud_id,&record,true)?,
            "local"=>{tx.execute("INSERT INTO native_sync_outbox(entity_table,id,action,payload,base_revision,base_updated_at) VALUES(?1,?2,?3,?4,?5,?6)",params![table,id,if local.is_null(){"delete"}else{"put"},if local.is_null(){None}else{Some(local.to_string())},text(&record,"revision")?,record["payload"]["updated_at"].as_str()]).map_err(sql_error)?;},
            _=>return Err("이 기기 또는 Cloud 중 선택해 주세요.".into()),
        }
        tx.execute("DELETE FROM native_sync_conflicts WHERE entity_table=?1 AND id=?2",params![table,id]).map_err(sql_error)?;
        tx.execute("UPDATE native_sync_control SET applying=0",[]).map_err(sql_error)?;
        tx.commit().map_err(sql_error)
    }
}
