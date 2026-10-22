// Membaca ID sesi chat dari browser; buat sesi baru jika belum pernah ada.
let sessionId = localStorage.getItem('chat_session') || generateSessionId();
localStorage.setItem('chat_session', sessionId);

// Key localStorage yang dipakai untuk menyimpan semua riwayat percakapan.
const HISTORY_STORAGE_KEY = 'chat_history';

// Membuat ID unik sederhana untuk membedakan setiap percakapan.
function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 9);
}

// Mengambil riwayat dari localStorage dan hanya menerima data dengan bentuk yang valid.
function loadChatHistory() {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!savedHistory) return [];

    try {
        const history = JSON.parse(savedHistory);
        return Array.isArray(history)
            ? history.filter((conversation) => conversation && typeof conversation.id === 'string' && Array.isArray(conversation.messages))
            : [];
    } catch (error) {
        console.error('Riwayat percakapan tidak dapat dibaca dari penyimpanan browser.', error);
        return [];
    }
}

// Menyiapkan daftar percakapan dan percakapan yang sedang aktif.
const chatHistory = loadChatHistory();
let currentConversation = chatHistory.find((conversation) => conversation.id === sessionId) || {
    id: sessionId,
    title: 'Percakapan baru',
    messages: [],
    updatedAt: Date.now()
};

// Mengambil elemen-elemen HTML yang akan dikendalikan oleh script ini.
const chatMessages = document.getElementById('chatMessages');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const historyToggle = document.getElementById('historyToggle');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatForm = document.getElementById('chatForm');
const welcome = document.getElementById('welcome');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const attachmentList = document.getElementById('attachmentList');
// Menyimpan file yang sudah dipilih pengguna sebelum dikirim.
let selectedFiles = [];

// Menampilkan atau menyembunyikan tombol scroll berdasarkan posisi gulir chat.
function updateScrollBottomButton() {
    const distanceFromBottom = chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop;
    scrollBottomBtn.hidden = !chatMessages.classList.contains('has-messages') || distanceFromBottom <= 2;
}

// Menyimpan riwayat percakapan ke browser lalu memperbarui daftar di sidebar.
function saveChatHistory() {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(chatHistory));
    renderChatHistory();
}

// Membuat daftar riwayat chat di sidebar dan mengurutkannya dari yang terbaru.
function renderChatHistory() {
    chatHistoryList.replaceChildren();
    chatHistory
        .slice()
        .sort((first, second) => second.updatedAt - first.updatedAt)
        .forEach((conversation) => {
            const item = document.createElement('button');
            item.className = `chat-history-item${conversation.id === sessionId ? ' active' : ''}`;
            item.type = 'button';
            item.textContent = conversation.title || 'Percakapan baru';
            item.title = item.textContent;
            item.addEventListener('click', () => openConversation(conversation.id));
            chatHistoryList.appendChild(item);
        });
}

// Menambahkan pesan ke percakapan aktif serta memperbarui judul dan waktu percakapan.
function recordMessage(text, sender, attachments) {
    currentConversation.messages.push({
        sender,
        text,
        attachments: attachments.map((file) => file.name)
    });
    currentConversation.updatedAt = Date.now();
    if (sender === 'user' && currentConversation.title === 'Percakapan baru') {
        currentConversation.title = text.trim().slice(0, 42) || 'Lampiran';
    }

    const existingIndex = chatHistory.findIndex((conversation) => conversation.id === currentConversation.id);
    if (existingIndex === -1) {
        chatHistory.push(currentConversation);
    } else {
        chatHistory[existingIndex] = currentConversation;
    }
    saveChatHistory();
}

// Membuat gelembung pesan di halaman, termasuk indikator mengetik dan nama lampiran.
function addMessage(text, sender, isLoading = false, attachments = [], persist = true) {
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
    updateScrollBottomButton();
    if (persist && !isLoading && (sender === 'user' || sender === 'bot')) {
        recordMessage(text, sender, attachments);
    }
    return div;
}

// Mengubah karakter khusus menjadi teks aman sebelum ditampilkan sebagai HTML.
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Memformat jawaban bot sederhana, seperti judul, daftar, tabel, dan garis pemisah.
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

// Memisahkan satu baris tabel menjadi beberapa isi sel.
function getTableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

// Memeriksa apakah sebuah baris merupakan pemisah kolom tabel Markdown.
function isTableDivider(line) {
    const cells = getTableCells(line);
    return line.includes('|') && cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

// Membuat elemen sel tabel (header atau isi) sesuai jumlah kolom.
function renderTableCells(cells, columnCount, tag) {
    return Array.from({ length: columnCount }, (_, index) => {
        const cell = cells[index] || '';
        return `<${tag}>${formatInline(cell)}</${tag}>`;
    }).join('');
}

// Memformat teks di dalam satu baris, misalnya tebal dan miring.
function formatInline(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}

// Mengirim teks dan lampiran ke server, lalu menampilkan jawaban atau pesan error.
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

// Menampilkan file yang dipilih sebagai chip dan menyediakan tombol untuk menghapusnya.
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

// Mengosongkan tampilan chat dan menyiapkan sesi percakapan baru.
function startNewChat() {
    if (sendBtn.disabled) return;
    closeMobileHistory();
    sessionId = generateSessionId();
    localStorage.setItem('chat_session', sessionId);
    currentConversation = {
        id: sessionId,
        title: 'Percakapan baru',
        messages: [],
        updatedAt: Date.now()
    };
    chatMessages.replaceChildren();
    chatMessages.classList.remove('has-messages');
    scrollBottomBtn.hidden = true;
    renderChatHistory();
    welcome.hidden = false;
    userInput.value = '';
    userInput.style.height = 'auto';
    selectedFiles = [];
    fileInput.value = '';
    renderAttachments();
    userInput.focus();
}

// Memuat pesan dari percakapan yang dipilih ke area chat.
function openConversation(id) {
    if (sendBtn.disabled) return;
    const conversation = chatHistory.find((item) => item.id === id);
    if (!conversation) return;

    closeMobileHistory();
    sessionId = conversation.id;
    currentConversation = conversation;
    localStorage.setItem('chat_session', sessionId);
    chatMessages.replaceChildren();
    chatMessages.classList.remove('has-messages');
    welcome.hidden = true;
    conversation.messages.forEach((message) => {
        addMessage(message.text, message.sender, false, (message.attachments || []).map((name) => ({ name })), false);
    });
    renderChatHistory();
    updateScrollBottomButton();
}

// Menutup sidebar riwayat pada tampilan mobile dan memperbarui atribut aksesibilitas.
function closeMobileHistory() {
    document.querySelector('.sidebar').classList.remove('mobile-open');
    historyToggle.setAttribute('aria-expanded', 'false');
    historyToggle.setAttribute('aria-label', 'Buka riwayat percakapan');
}

// Membuka atau menutup sidebar riwayat saat tombol riwayat ditekan.
historyToggle.addEventListener('click', () => {
    const isOpen = document.querySelector('.sidebar').classList.toggle('mobile-open');
    historyToggle.setAttribute('aria-expanded', String(isOpen));
    historyToggle.setAttribute('aria-label', `${isOpen ? 'Tutup' : 'Buka'} riwayat percakapan`);
});

// Mengirim pesan saat form chat disubmit tanpa memuat ulang halaman.
chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage();
});

// Menggulir area percakapan ke pesan paling bawah dengan animasi.
scrollBottomBtn.addEventListener('click', () => {
    chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: 'smooth'
    });
});

// Memperbarui tombol scroll ketika posisi gulir area chat berubah.
chatMessages.addEventListener('scroll', updateScrollBottomButton);

// Menyesuaikan tinggi kotak input dengan isi teks, maksimal 150 piksel.
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
});

// Enter mengirim pesan; Shift+Enter tetap membuat baris baru.
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

// Mengisi input dan langsung mengirim prompt ketika kartu saran dipilih.
document.querySelectorAll('.suggestion-card').forEach((button) => {
    button.addEventListener('click', () => {
        userInput.value = button.dataset.prompt;
        userInput.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

// Menghubungkan tombol percakapan baru dan tombol lampiran dengan aksinya.
document.getElementById('newChatBtn').addEventListener('click', startNewChat);
attachBtn.addEventListener('click', () => fileInput.click());
// Menambahkan file pilihan jika jumlah total lampiran tidak melebihi empat.
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

// Pintasan Ctrl+K atau Cmd+K memulai percakapan baru.
document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        startNewChat();
    }
});

// Mengambil tombol tema dan tema yang terakhir disimpan di browser.
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme');

// Menerapkan tema terang/gelap, memperbarui label tombol, dan menyimpan pilihan.
function setTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    themeToggle.setAttribute('aria-label', `Aktifkan mode ${isDark ? 'terang' : 'gelap'}`);
    themeToggle.title = `Aktifkan mode ${isDark ? 'terang' : 'gelap'}`;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Memulihkan tema dan riwayat saat halaman pertama kali dibuka.
setTheme(savedTheme === 'dark' ? 'dark' : 'light');
themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

renderChatHistory();
if (currentConversation.messages.length) {
    openConversation(currentConversation.id);
}