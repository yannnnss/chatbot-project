import base64

import requests

from config import AI_MODEL, API_KEY, API_URL, OLLAMA_MODEL, OLLAMA_VISION_MODEL, USE_OLLAMA, VISION_MODEL

if USE_OLLAMA:
    import ollama


class AIServiceError(RuntimeError):
    pass


def get_ai_response(user_message, history, images=None, document_text=''):
    images = images or []
    messages = [{'role': 'system', 'content': 'Kamu adalah asisten yang ramah dan membantu.'}]
    for item in history:
        messages.append({
            'role': 'user' if item['sender'] == 'user' else 'assistant',
            'content': item['message'],
        })
    prompt = user_message
    if document_text:
        prompt += f'\n\n{document_text}'

    current_message = {'role': 'user', 'content': prompt}
    if images and USE_OLLAMA:
        current_message['images'] = [image['data'] for image in images]
    elif images:
        current_message['content'] = [{'type': 'text', 'text': prompt}]
        for image in images:
            encoded_image = base64.b64encode(image['data']).decode('ascii')
            current_message['content'].append({
                'type': 'image_url',
                'image_url': {'url': f"data:{image['mime_type']};base64,{encoded_image}"},
            })
    messages.append(current_message)

    if USE_OLLAMA:
        try:
            model = OLLAMA_VISION_MODEL if images else OLLAMA_MODEL
            response = ollama.chat(model=model, messages=messages)
        except (ollama.RequestError, ollama.ResponseError) as exc:
            raise AIServiceError(f'Ollama gagal: {exc}') from exc
        content = response['message']['content']
        if not content:
            raise AIServiceError('Ollama mengembalikan jawaban kosong.')
        return content

    if not API_KEY:
        raise AIServiceError(
            'GROQ_API_KEY belum diatur. Atur environment variable GROQ_API_KEY '
            'atau aktifkan USE_OLLAMA=true untuk memakai Ollama.'
        )

    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    }
    model = VISION_MODEL if images else AI_MODEL
    payload = {'model': model, 'messages': messages}
    try:
        response = requests.post(API_URL, json=payload, headers=headers, timeout=45)
    except requests.RequestException as exc:
        raise AIServiceError(f'Tidak dapat menghubungi layanan AI: {exc}') from exc

    if not response.ok:
        detail = response.text.strip()
        if len(detail) > 500:
            detail = f'{detail[:500]}...'
        if images and response.status_code == 404:
            raise AIServiceError(
                f'Model vision "{model}" tidak tersedia untuk akun ini. '
                'Atur GROQ_VISION_MODEL ke model vision yang tersedia di Groq.'
            )
        raise AIServiceError(
            f'Provider AI mengembalikan HTTP {response.status_code}: '
            f'{detail or response.reason}'
        )

    try:
        data = response.json()
        content = data['choices'][0]['message']['content']
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise AIServiceError('Provider AI mengembalikan format respons yang tidak valid.') from exc

    if not isinstance(content, str) or not content.strip():
        raise AIServiceError('Provider AI mengembalikan jawaban kosong.')
    return content.strip()
