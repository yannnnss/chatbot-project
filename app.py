import os
import uuid
from io import BytesIO

import mysql.connector
from flask import Flask, jsonify, render_template, request
from werkzeug.utils import secure_filename

from ai_service import AIServiceError, get_ai_response
from database import save_message, get_history

app = Flask(__name__)
MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
MAX_ATTACHMENTS = 4
MAX_DOCUMENT_CHARS = 12000
app.config['MAX_CONTENT_LENGTH'] = MAX_ATTACHMENT_BYTES * MAX_ATTACHMENTS + 1024 * 1024

IMAGE_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
}
DOCUMENT_TYPES = {'.pdf', '.txt', '.md', '.csv', '.docx'}


def read_attachments(uploaded_files):
    images = []
    documents = []
    filenames = []

    for uploaded_file in uploaded_files:
        if not uploaded_file or not uploaded_file.filename:
            continue
        if len(filenames) >= MAX_ATTACHMENTS:
            raise ValueError(f'Maksimal {MAX_ATTACHMENTS} file dalam satu pesan.')

        original_filename = uploaded_file.filename
        extension = os.path.splitext(original_filename)[1].lower()
        filename = secure_filename(original_filename) or f'lampiran{extension}'
        if extension not in IMAGE_TYPES and extension not in DOCUMENT_TYPES:
            raise ValueError('Format file yang didukung: PNG, JPG, WEBP, PDF, TXT, MD, CSV, dan DOCX.')

        content = uploaded_file.read(MAX_ATTACHMENT_BYTES + 1)
        if len(content) > MAX_ATTACHMENT_BYTES:
            raise ValueError(f'Ukuran setiap file maksimal {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB.')
        if not content:
            raise ValueError(f'File {filename} kosong.')

        filenames.append(filename or 'lampiran')
        if extension in IMAGE_TYPES:
            images.append({
                'filename': filenames[-1],
                'mime_type': IMAGE_TYPES[extension],
                'data': content,
            })
            continue

        try:
            if extension == '.pdf':
                from pypdf import PdfReader

                text = '\n'.join(page.extract_text() or '' for page in PdfReader(BytesIO(content)).pages)
            elif extension == '.docx':
                from docx import Document

                text = '\n'.join(paragraph.text for paragraph in Document(BytesIO(content)).paragraphs)
            else:
                text = content.decode('utf-8-sig')
        except ImportError as exc:
            raise ValueError('Pustaka pembaca dokumen belum terpasang. Jalankan pip install -r requirements.txt.') from exc
        except Exception as exc:
            raise ValueError(f'File {filenames[-1]} tidak dapat dibaca.') from exc

        if not text.strip():
            raise ValueError(f'Tidak ada teks yang dapat dibaca di {filenames[-1]}.')
        documents.append(f'Isi file {filenames[-1]}:\n{text.strip()}')

    document_text = '\n\n'.join(documents)
    if len(document_text) > MAX_DOCUMENT_CHARS:
        document_text = document_text[:MAX_DOCUMENT_CHARS] + '\n[Isi dokumen dipotong karena batas panjang.]'
    return images, document_text, filenames


@app.route('/')
def index():
    return render_template('index.html')


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify(error='Total ukuran lampiran terlalu besar. Maksimal 4 file, masing-masing 8 MB.'), 413


@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json(silent=True) if request.is_json else request.form
    if data is None or not hasattr(data, 'get'):
        return jsonify(error='Kirim pesan atau lampiran yang valid.'), 400

    user_message = data.get('message')
    if not isinstance(user_message, str):
        return jsonify(error='Pesan tidak valid.'), 400
    user_message = user_message.strip()

    try:
        images, document_text, filenames = read_attachments(request.files.getlist('files'))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    if not user_message and not filenames:
        return jsonify(error='Tulis pesan atau pilih file terlebih dahulu.'), 400
    if not user_message:
        user_message = 'Tolong baca dan jelaskan lampiran ini.'

    session_id = data.get('session_id') or str(uuid.uuid4())
    if not isinstance(session_id, str) or len(session_id) > 100:
        return jsonify(error='session_id tidak valid.'), 400

    try:
        history = get_history(session_id, limit=10)
    except mysql.connector.Error:
        app.logger.exception('Gagal membaca riwayat chat dari MySQL.')
        return jsonify(error='Database tidak dapat diakses. Pastikan MySQL aktif dan database chatbot_db sudah dibuat.'), 503

    try:
        bot_response = get_ai_response(user_message, history, images, document_text)
    except AIServiceError as exc:
        app.logger.warning('Permintaan ke layanan AI gagal: %s', exc)
        return jsonify(error=str(exc)), 502

    try:
        history_message = user_message
        if filenames:
            history_message += f"\n[Lampiran: {', '.join(filenames)}]"
        save_message(session_id, 'user', history_message)
        save_message(session_id, 'bot', bot_response)
    except mysql.connector.Error:
        app.logger.exception('Gagal menyimpan percakapan ke MySQL.')
        return jsonify(error='Jawaban AI berhasil dibuat, tetapi gagal disimpan ke database. Periksa koneksi dan tabel chat_history.'), 503

    return jsonify(session_id=session_id, response=bot_response)

if __name__ == '__main__':
    app.run(debug=True, port=5000)