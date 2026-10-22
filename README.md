## Menjalankan dengan Groq
1. Jalankan `database.sql` di phpMyAdmin atau MySQL Workbench. Untuk Laragon standar, konfigurasi MySQL bawaan aplikasi memakai `localhost`, user `root`, tanpa password, dan database `chatbot_db`.
2. Buka PowerShell di folder proyek. Pasang dependensi jika belum terpasang:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```
3. Atur API key Groq yang masih aktif di PowerShell. Jangan simpan API key di file kode:

   ```powershell
   $env:GROQ_API_KEY = "API_GROQ"
   ```
4. Jalankan server:

   ```powershell
   python app.py
   ```
5. Buka `   http://127.0.0.1:5000` di browser.

API key cloud harus memiliki akses ke model yang dipilih. Pesan error dari Groq akan ditampilkan di chat untuk membantu mengecek key, model, kuota, dan koneksi.

## Lampiran

Composer mendukung sampai 4 file per pesan, maksimal 8 MB per file: PNG, JPG, WEBP, PDF, TXT, MD, CSV, dan DOCX. Isi dokumen diekstrak sementara di memori; PDF perlu memiliki teks yang bisa dipilih, karena PDF hasil scan belum menjalani OCR.

Foto memakai model vision. Untuk Groq, model default adalah `qwen/qwen3.8-27b`; ubah dengan `GROQ_VISION_MODEL` jika perlu. Untuk Ollama, pasang model vision lalu atur `OLLAMA_VISION_MODEL` (default `llava`).

## Menggunakan Ollama lokal

Pastikan Ollama aktif dan model yang dipilih sudah diunduh. Kemudian, di PowerShell yang sama:

```powershell
$env:USE_OLLAMA = "true"
$env:OLLAMA_MODEL = "deepseek"
.\.venv\Scripts\python.exe app.py
```
