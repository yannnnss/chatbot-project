let sessionId = localStorage.getItem('chat_session') || generateSessionId();
localStorage.setItem('chat_session', sessionId);

function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9);
}

const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatForm = document.getElementById('chatForm');
const welcome = document.getElementById('welcome');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachmentList = document.getElementById('attachmentList');
let selectedFiles = [];

function addMessage(text, sender, isLoading = false, attachments = []) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (isLoading) {
        bubble.innerHTML = '<span class="typing-indicator" aria-label="AI sedang mengetik"><span></span><span></span><span></span></span>';
    } else if (sender.startsWith('bot')) {
        bubble.innerHTML = formatMessage(text);
    } else {
        bubble.textContent = text;
        if (attachments.length) {
            const attachmentNames = document.createElement('div');
            attachmentNames.className = 'message-attachments';
            attachments.forEach((file) => {
                const name = document.createElement('span');
                name.textContent = file.name;
                attachmentNames.appendChild(name);
            });
            bubble.appendChild(attachmentNames);
        }
    }
    div.appendChild(bubble);
    chatMessages.appendChild(div);
    chatMessages.classList.add('has-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMessage(text) {
    const lines = escapeHtml(text).replace(/\r\n?/g, '\n').split('\n');
    const output = [];
    let inList = false;

    const closeList = () => {
        if (inList) output.push('</ul>');
        inList = false;
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
        const item = line.match(/^\s*[-*]\s+(.+)$/);

        if (line.includes('|') && isTableDivider(lines[index + 1] || '')) {
            closeList();
            const headers = getTableCells(line);
            const columnCount = headers.length;
            output.push('<div class="table-wrap"><table><thead><tr>');
            output.push(renderTableCells(headers, columnCount, 'th'));
            output.push('</tr></thead><tbody>');
            index += 2;

            while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
                output.push('<tr>');
                output.push(renderTableCells(getTableCells(lines[index]), columnCount, 'td'));
                output.push('</tr>');
                index += 1;
            }

            output.push('</tbody></table></div>');
            index -= 1;
        } else if (item) {
            if (!inList) output.push('<ul>');
            inList = true;
            output.push(`<li>${formatInline(item[1])}</li>`);
        } else {
            closeList();
            if (heading) {
                const level = heading[1].length;
                output.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
            } else if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
                output.push('<hr>');
            } else if (line.trim()) {
                output.push(`${formatInline(line)}<br>`);
            } else {
                output.push('<br>');
            }
        }
    }

    closeList();
    return output.join('');
}

function getTableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line) {
    const cells = getTableCells(line);
    return line.includes('|') && cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderTableCells(cells, columnCount, tag) {
    return Array.from({ length: columnCount }, (_, index) => {
        const cell = cells[index] || '';
        return `<${tag}>${formatInline(cell)}</${tag}>`;
    }).join('');
}

function formatInline(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}

async function sendMessage() {
    const message = userInput.value.trim();
    if ((!message && !selectedFiles.length) || sendBtn.disabled) return;

    const filesToSend = [...selectedFiles];
    const visibleMessage = message || 'Tolong baca dan jelaskan lampiran ini.';
    addMessage(visibleMessage, 'user', false, filesToSend);
    userInput.value = '';
    userInput.style.height = 'auto';
    selectedFiles = [];
    renderAttachments();
    welcome.hidden = true;
    addMessage('', 'bot', true);
    const loadingMessage = chatMessages.lastElementChild;
    sendBtn.disabled = true;
    attachBtn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('session_id', sessionId);
        filesToSend.forEach((file) => formData.append('files', file));
        const response = await fetch('/chat', {
            method: 'POST',
            body: formData
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `Server mengembalikan HTTP ${response.status}.`);
        }
        if (typeof data.response !== 'string' || !data.response.trim()) {
            throw new Error('Server tidak mengembalikan jawaban AI.');
        }
        sessionId = data.session_id || sessionId;
        localStorage.setItem('chat_session', sessionId);
        loadingMessage.remove();
        addMessage(data.response, 'bot');
    } catch (err) {
        loadingMessage.remove();
        addMessage(err.message || 'Tidak dapat terhubung ke server.', 'bot error');
    } finally {
        sendBtn.disabled = false;
        attachBtn.disabled = false;
        userInput.focus();
    }
}

function renderAttachments() {
    attachmentList.replaceChildren();
    attachmentList.hidden = selectedFiles.length === 0;
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('span');
        item.className = 'attachment-chip';
        const name = document.createElement('span');
        name.textContent = file.name;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Hapus ${file.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
            selectedFiles.splice(index, 1);
            renderAttachments();
        });
        item.append(name, remove);
        attachmentList.appendChild(item);
    });
}

function startNewChat() {
    if (sendBtn.disabled) return;
    sessionId = generateSessionId();
    localStorage.setItem('chat_session', sessionId);
    chatMessages.replaceChildren();
    chatMessages.classList.remove('has-messages');
    welcome.hidden = false;
    userInput.value = '';
    userInput.style.height = 'auto';
    selectedFiles = [];
    fileInput.value = '';
    renderAttachments();
    userInput.focus();
}

chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage();
});

userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
});

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

document.querySelectorAll('.suggestion-card').forEach((button) => {
    button.addEventListener('click', () => {
        userInput.value = button.dataset.prompt;
        userInput.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

document.getElementById('newChatBtn').addEventListener('click', startNewChat);
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    const additions = Array.from(fileInput.files);
    if (selectedFiles.length + additions.length > 4) {
        addMessage('Maksimal 4 file dalam satu pesan.', 'bot error');
    } else {
        selectedFiles.push(...additions);
        renderAttachments();
    }
    fileInput.value = '';
});

document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        startNewChat();
    }
});