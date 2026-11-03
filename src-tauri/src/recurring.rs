//! Bounded, atomic creation of Tasks and immutable recurrence identities.
use super::*;
use chrono::Datelike;
fn scheduled(rule: &Value, requested: &[String]) -> Result<Vec<String>> {
    validate("task_recurrences", rule)?;
    if requested.is_empty() || requested.len() > 31 || rule["status"] != "active" {
        return Err("활성 반복에서 한 번에 1~31회를 생성할 수 있습니다.".into());
    }
    let start = NaiveDate::parse_from_str(text(rule, "start_date")?, "%Y-%m-%d")
        .map_err(|_| "시작일 오류")?;
    let mut requested = requested.to_vec();
    requested.sort();
    requested.dedup();
    for d in &requested {
        date(&json!({"day":d}), "day")?;
    }
    let end = NaiveDate::parse_from_str(requested.last().unwrap(), "%Y-%m-%d")
        .map_err(|_| "날짜 오류")?;
    if (end - start).num_days() > 36600 || end < start {
        return Err("반복 생성 범위 오류".into());
    }
    let interval = rule["interval_days"].as_i64().unwrap();
    let mut count = 0;
    let mut result = Vec::new();
    for offset in 0..=(end - start).num_days() {
        let d = start + chrono::Duration::days(offset);
        let day = d.to_string();
        if rule["end_date"]
            .as_str()
            .is_some_and(|last| day.as_str() > last)
        {
            break;
        }
        let weekdays = text(rule, "weekdays")?;
        let weekday = d.weekday().num_days_from_sunday().to_string();
        let matches = match text(rule, "frequency")? {
            "daily" => offset % interval == 0,
            "weekdays" => offset % interval == 0 && d.weekday().num_days_from_monday() < 5,
            "weekly" => {
                (offset + i64::from(start.weekday().num_days_from_monday())) / 7 % interval == 0
                    && if weekdays.is_empty() {
                        d.weekday() == start.weekday()
                    } else {
                        weekdays.split(',').any(|n| n == weekday)
                    }
            }
            "monthly" => {
                ((d.year() - start.year()) * 12 + d.month() as i32 - start.month() as i32) as i64
                    % interval
                    == 0
                    && d.day() == start.day()
            }
            "yearly" => {
                i64::from(d.year() - start.year()) % interval == 0
                    && d.month() == start.month()
                    && d.day() == start.day()
            }
            _ => false,
        };
        if !matches {
            continue;
        }
        count += 1;
        if rule["occurrence_limit"]
            .as_i64()
            .is_some_and(|max| count > max)
        {
            break;
        }
        if requested.binary_search(&day).is_ok() {
            result.push(day);
        }
    }
    if result != requested {
        return Err("반복 규칙에 맞지 않는 회차입니다. 새로고침 후 다시 시도해 주세요.".into());
    }
    Ok(result)
}
impl Database {
    pub fn generate_tasks(
        &mut self,
        recurrence_id: &str,
        revision: &str,
        days: Vec<String>,
    ) -> Result<()> {
        self.require_workspace()?;
        let owner = self.owner()?;
        let tx = self.conn.transaction().map_err(sql_error)?;
        let rule = json_rows(
            &tx,
            "SELECT * FROM task_recurrences WHERE id=?1 AND user_id=?2",
            &[
                SqlValue::Text(recurrence_id.into()),
                SqlValue::Text(owner.clone()),
            ],
        )?
        .into_iter()
        .next()
        .ok_or("반복 규칙이 없습니다.")?;
        if rule["updated_at"] != revision {
            return Err("반복 규칙이 변경되었습니다. 새로고침 후 다시 시도해 주세요.".into());
        }
        for day in scheduled(&rule, &days)? {
            let id = completion_id(recurrence_id, &day);
            let exists: bool = tx
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM task_occurrences WHERE id=?1)",
                    [&id],
                    |r| r.get(0),
                )
                .map_err(sql_error)?;
            if exists {
                continue;
            }
            let task = json!({"title":rule["title"],"description":rule["description"],"priority":rule["priority"],"status":"todo","start_date":day,"due_date":day,"project_id":rule["project_id"]});
            Self::write(&tx, &owner, "tasks", &task, &id, false, false)?;
            Self::write(
                &tx,
                &owner,
                "task_occurrences",
                &json!({"recurrence_id":recurrence_id,"local_date":day,"task_id":id}),
                &id,
                false,
                false,
            )?;
        }
        tx.commit().map_err(sql_error)
    }
}
