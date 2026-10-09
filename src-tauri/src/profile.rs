use crate::{valid_avatar_name, Database};
use image::{ImageFormat, ImageReader, Limits};
use std::io::{Cursor, Read, Write};
use std::path::Path;

pub const AVATAR_INPUT_LIMIT: u64 = 10 * 1024 * 1024;
// Decode only selected formats, bound decoded memory, strip metadata and store a small private PNG.
pub fn normalize_avatar(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.is_empty() || bytes.len() as u64 > AVATAR_INPUT_LIMIT {
        return Err("사진은 10 MB 이하의 PNG/JPEG/WebP 파일로 선택해 주세요.".into());
    }
    let format = image::guess_format(bytes)
        .map_err(|_| "이미지를 읽을 수 없습니다. 다른 사진을 선택해 주세요.")?;
    if !matches!(
        format,
        ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP
    ) {
        return Err("PNG/JPEG/WebP 사진만 지원합니다.".into());
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    let mut limits = Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let image = reader
        .decode()
        .map_err(|_| "손상되었거나 너무 큰 사진입니다. 기존 사진은 보존됩니다.")?;
    let mut output = Cursor::new(Vec::new());
    image
        .thumbnail(256, 256)
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|_| "프로필 사진 처리에 실패했습니다.")?;
    Ok(output.into_inner())
}

impl Database {
    pub fn read_avatar(&self, dir: &Path) -> Result<Option<Vec<u8>>, String> {
        let Some(name) = self.avatar_name()? else {
            return Ok(None);
        };
        if !valid_avatar_name(&name) {
            return Err("프로필 사진 경로 오류".into());
        }
        let mut bytes = Vec::new();
        std::fs::File::open(dir.join(name))
            .map_err(|_| "로컬 사진을 읽을 수 없습니다. 프로필에서 다시 선택해 주세요.")?
            .take(1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "로컬 사진 읽기 오류")?;
        if bytes.len() > 1024 * 1024 {
            return Err("로컬 사진 크기 오류".into());
        }
        Ok(Some(bytes))
    }
    pub fn store_avatar(&mut self, dir: &Path, bytes: &[u8]) -> Result<(), String> {
        self.require_workspace()?;
        let png = normalize_avatar(bytes)?;
        std::fs::create_dir_all(dir).map_err(|_| "프로필 저장 폴더를 열 수 없습니다.")?;
        let old = self.avatar_name()?;
        let name = format!("{}.png", uuid::Uuid::new_v4());
        let path = dir.join(&name);
        let write = || -> std::io::Result<()> {
            let mut file = std::fs::File::create(&path)?;
            file.write_all(&png)?;
            file.sync_all()
        };
        if write().is_err() {
            let _ = std::fs::remove_file(&path);
            return Err("사진을 저장할 수 없습니다. 기존 사진은 보존됩니다.".into());
        }
        if let Err(e) = self.set_avatar_name(Some(&name)) {
            let _ = std::fs::remove_file(&path);
            return Err(e);
        }
        if let Some(old) = old.filter(|n| valid_avatar_name(n)) {
            let _ = std::fs::remove_file(dir.join(old));
        }
        Ok(())
    }
    pub fn remove_avatar(&mut self, dir: &Path) -> Result<(), String> {
        let old = self.avatar_name()?;
        self.set_avatar_name(None)?;
        if let Some(name) = old.filter(|n| valid_avatar_name(n)) {
            let _ = std::fs::remove_file(dir.join(name));
        }
        Ok(())
    }
}
