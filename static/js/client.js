document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    function setCookie(name, value, days = 365) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${value};${expires};path=/`;
    }

    function getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    const textarea = document.getElementById('search-input');
    const submitBtn = document.getElementById('submit-btn');
    const chatSearch = document.querySelector('.chat-search');
    const chatMessages = document.querySelector('.chat-messages');
    const isOnChatPage = !!chatSearch;
    let chatId = null;
    if (isOnChatPage) {
        chatId = chatSearch.dataset.chatId || null;
        if (!chatId) {
            const pathParts = window.location.pathname.split('/');
            const urlChatId = pathParts[pathParts.length - 1];
            if (urlChatId && !isNaN(urlChatId)) {
                chatId = urlChatId;
            }
        }
    }

    const messagesContainer = document.getElementById('messages-container');
    const mainMessages = document.getElementById('main-messages');

    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
        const savedModel = getCookie('selected_model');
        if (savedModel) {
            modelSelect.value = savedModel;
        }

        modelSelect.addEventListener('change', (e) => {
            setCookie('selected_model', e.target.value);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderMarkdown(text) {
        if (!text) return '';
        try {
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                return marked.parse(text);
            }
            return escapeHtml(text);
        } catch (e) {
            console.error('Markdown rendering error:', e);
            return escapeHtml(text);
        }
    }

    if (isOnChatPage && typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });

        const assistantMessages = document.querySelectorAll('.message.assistant .message-content.markdown-content');
        assistantMessages.forEach(contentDiv => {
            const searchResultsContainer = contentDiv.querySelector('.search-results-container');
            const hasRenderedMarkdown = contentDiv.querySelector('strong, em, code, pre, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, table, p');

            if (hasRenderedMarkdown && !searchResultsContainer) {
                return;
            }

            if (searchResultsContainer) {
                const afterSearch = [];
                let node = searchResultsContainer.nextSibling;
                while (node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        afterSearch.push(node.textContent);
                    } else if (node.nodeType === Node.ELEMENT_NODE && !node.querySelector('strong, em, code, pre')) {
                        afterSearch.push(node.textContent || node.innerText);
                    }
                    node = node.nextSibling;
                }
                const markdownText = afterSearch.join('').trim();

                if (markdownText && !hasRenderedMarkdown) {
                    try {
                        const rendered = marked.parse(markdownText);
                        let nextNode = searchResultsContainer.nextSibling;
                        while (nextNode) {
                            const toCheck = nextNode;
                            nextNode = nextNode.nextSibling;
                            if (toCheck.nodeType === Node.TEXT_NODE ||
                                (toCheck.nodeType === Node.ELEMENT_NODE && !toCheck.querySelector('strong, em, code, pre, h1, h2, h3'))) {
                                toCheck.remove();
                            }
                        }
                        searchResultsContainer.insertAdjacentHTML('afterend', rendered);
                    } catch (e) {
                        console.error('Markdown rendering error:', e);
                    }
                }
            } else {
                const textContent = contentDiv.textContent || contentDiv.innerText;
                if (textContent && (textContent.includes('**') || textContent.includes('*') || textContent.includes('`') || textContent.includes('#')) && !hasRenderedMarkdown) {
                    try {
                        const rendered = marked.parse(textContent);
                        contentDiv.innerHTML = rendered;
                    } catch (e) {
                        console.error('Markdown rendering error:', e);
                    }
                }
            }
        });
    }

    function addMessageToUI(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const renderedContent = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content);

        if (role === 'assistant') {
            messageDiv.innerHTML = /*HTML*/`
                <div class="message-header">
                    <div class="avatar ai"><i data-lucide="snowflake" class="avatar-icon"></i></div>
                    <span>Perplexicat</span>
                </div>
                <div class="message-content markdown-content">
                    ${renderedContent}
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">
                    ${renderedContent}
                </div>
            `;
        }

        const container = isOnChatPage ? chatMessages : mainMessages;
        if (container) {
            container.appendChild(messageDiv);
            lucide.createIcons();
            const scrollContainer = isOnChatPage ? chatMessages : messagesContainer;
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
        return messageDiv;
    }

    function addLoadingMessage(statusText = 'Thinking...') {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant loading';
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="avatar ai"><i data-lucide="snowflake" class="avatar-icon"></i></div>
                <span>Perplexicat</span>
            </div>
            <div class="message-content">
                <div class="loading-indicator">
                    <div class="loading-spinner"></div>
                    <span class="loading-text">${statusText}</span>
                </div>
            </div>
        `;

        const container = isOnChatPage ? chatMessages : mainMessages;
        if (container) {
            container.appendChild(messageDiv);
            lucide.createIcons();
            const scrollContainer = isOnChatPage ? chatMessages : messagesContainer;
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
        return messageDiv;
    }

    function updateLoadingStatus(loadingMessageDiv, statusText) {
        if (loadingMessageDiv) {
            const loadingText = loadingMessageDiv.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = statusText;
            }
        }
    }

    function buildSearchResultsHTML(searchResults) {
        if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
            return '';
        }

        const resultsHTML = searchResults.slice(0, 5).map(result => {
            if (!result || !result.url) return '';

            const favicon = result.favicon || '';
            const title = result.title || 'Untitled';
            const content = result.content || '';
            const url = result.url || '';

            const faviconHTML = favicon ?
                `<img src="${escapeHtml(favicon)}" onerror="this.style.display='none'" class="search-result-favicon" />` :
                '<i data-lucide="globe" class="search-result-favicon-icon"></i>';

            const contentHTML = content ?
                `<div class="search-result-snippet">${escapeHtml(content.substring(0, 150))}</div>` :
                '';

            return `
                <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="search-result-item">
                    <div class="search-result-item-inner">
                        ${faviconHTML}
                        <div class="search-result-content">
                            <div class="search-result-title">${escapeHtml(title)}</div>
                            ${contentHTML}
                        </div>
                        <i data-lucide="external-link" class="search-result-external-link"></i>
                    </div>
                </a>
            `;
        }).filter(html => html).join('');

        if (!resultsHTML) return '';

        return `
            <div class="search-results-container">
                ${resultsHTML}
            </div>
        `;
    }

    let currentRequestController = null;
    let handleSubmit = null;

    if (textarea && submitBtn) {
        textarea.addEventListener('input', () => {
            if (textarea.value.trim() !== '') {
                submitBtn.innerHTML = '<i data-lucide="arrow-up"></i>';
            } else {
                submitBtn.innerHTML = '<i data-lucide="audio-lines"></i>';
            }
            lucide.createIcons();
        });

        handleSubmit = async () => {
            const query = textarea.value.trim();
            if (!query) return;

            if (currentRequestController) {
                currentRequestController.abort();
            }
            currentRequestController = new AbortController();

            const currentQuery = query;
            textarea.value = '';
            textarea.disabled = true;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="loading-spinner-small"></div>';
            lucide.createIcons();

            let loadingMessageDiv = null;

            if (isOnChatPage) {
                addMessageToUI('user', currentQuery);
                loadingMessageDiv = addLoadingMessage();
            } else {
            }

            try {
                const selectedModel = modelSelect ? modelSelect.value : 'gemma3:4b';

                if (modelSelect) {
                    setCookie('selected_model', selectedModel);
                }

                const body = {
                    query: currentQuery,
                    model: selectedModel,
                    use_sse: true
                };

                if (isOnChatPage && chatId) {
                    body.chat_id = parseInt(chatId);
                    body.is_followup = true;
                } else if (!isOnChatPage) {
                    const spaceSelect = document.getElementById('space-select');
                    const spaceId = spaceSelect ? spaceSelect.value : null;
                    if (spaceId) {
                        body.space_id = parseInt(spaceId);
                    }
                }

                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                    signal: currentRequestController.signal,
                });

                if (response.status === 401 || response.redirected) {
                    window.location.href = '/login';
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server returned ${response.status}`);
                }

                if (response.headers.get('content-type')?.includes('text/event-stream')) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let accumulatedResponse = '';
                    let searchResults = null;
                    let finalChatId = null;

                    let shouldRedirect = false;
                    let redirectUrl = null;

                    while (true) {
                        try {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.slice(6));

                                        if (data.type === 'chat_created') {
                                            if (!isOnChatPage && data.chat_id) {
                                                shouldRedirect = true;
                                                redirectUrl = `/chat/${data.chat_id}?q=${encodeURIComponent(currentQuery)}`;
                                                break;
                                            }
                                        } else if (data.type === 'status') {
                                            if (data.status === 'searching') {
                                                updateLoadingStatus(loadingMessageDiv, 'Searching...');
                                            } else if (data.status === 'thinking') {
                                                updateLoadingStatus(loadingMessageDiv, 'Thinking...');
                                            }
                                        } else if (data.type === 'chunk') {
                                            if (loadingMessageDiv) {
                                                if (loadingMessageDiv.classList.contains('loading')) {
                                                    loadingMessageDiv.classList.remove('loading');
                                                    const contentDiv = loadingMessageDiv.querySelector('.message-content');
                                                    contentDiv.innerHTML = '';
                                                    contentDiv.classList.add('markdown-content');
                                                }

                                                accumulatedResponse += data.chunk;
                                                const contentDiv = loadingMessageDiv.querySelector('.message-content');
                                                if (contentDiv) {
                                                    let contentHTML = buildSearchResultsHTML(searchResults);
                                                    contentHTML += renderMarkdown(accumulatedResponse);
                                                    contentDiv.innerHTML = contentHTML;
                                                    lucide.createIcons();

                                                    const scrollContainer = isOnChatPage ? chatMessages : messagesContainer;
                                                    if (scrollContainer) {
                                                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                                                    }
                                                }
                                            }
                                        } else if (data.type === 'complete') {
                                            if (loadingMessageDiv) {
                                                accumulatedResponse = data.response || accumulatedResponse;
                                                searchResults = data.search_results || searchResults;
                                                finalChatId = data.chat_id || finalChatId;

                                                loadingMessageDiv.classList.remove('loading');
                                                const contentDiv = loadingMessageDiv.querySelector('.message-content');

                                                let contentHTML = buildSearchResultsHTML(searchResults);
                                                contentHTML += renderMarkdown(accumulatedResponse);

                                                contentDiv.innerHTML = contentHTML;
                                                contentDiv.classList.add('markdown-content');
                                                lucide.createIcons();

                                                if (isOnChatPage) {
                                                    if (finalChatId) {
                                                        chatId = finalChatId.toString();
                                                        if (chatSearch) {
                                                            chatSearch.dataset.chatId = chatId;
                                                        }
                                                    }
                                                } else {
                                                    if (finalChatId) {
                                                        setTimeout(() => {
                                                            window.location.href = `/chat/${finalChatId}`;
                                                        }, 500);
                                                        return;
                                                    }
                                                }
                                            }
                                        } else if (data.type === 'error') {
                                            throw new Error(data.message || 'An error occurred');
                                        }
                                    } catch (e) {
                                        console.error('Error parsing SSE data:', e);
                                    }
                                }
                            }
                            
                            if (shouldRedirect) {
                                break;
                            }
                        } catch (error) {
                            if (error.name === 'AbortError') {
                                break;
                            }
                            throw error;
                        }
                    }
                    
                    if (shouldRedirect && redirectUrl) {
                        window.location.href = redirectUrl;
                        return;
                    }
                } else {
                    const data = await response.json();

                    if (data.response && loadingMessageDiv) {
                        loadingMessageDiv.classList.remove('loading');
                        const contentDiv = loadingMessageDiv.querySelector('.message-content');

                        let contentHTML = buildSearchResultsHTML(data.search_results);
                        contentHTML += renderMarkdown(data.response);

                        contentDiv.innerHTML = contentHTML;
                        contentDiv.classList.add('markdown-content');
                        lucide.createIcons();

                        if (isOnChatPage) {
                            if (data.chat_id) {
                                chatId = data.chat_id.toString();
                                if (chatSearch) {
                                    chatSearch.dataset.chatId = chatId;
                                }
                            }
                        } else {
                            if (data.chat_id) {
                                window.location.href = `/chat/${data.chat_id}?q=${encodeURIComponent(currentQuery)}`;
                                return;
                            }
                        }
                    }
                }

            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }
                console.error('Error:', error);
                if (loadingMessageDiv) {
                    loadingMessageDiv.classList.remove('loading');
                    const contentDiv = loadingMessageDiv.querySelector('.message-content');
                    if (contentDiv) {
                        contentDiv.innerHTML = `<span class="error-text">Error: ${error.message}</span>`;
                    }
                } else {
                    alert(`Error: ${error.message}`);
                }
            } finally {
                if (!currentRequestController || !currentRequestController.signal.aborted) {
                    textarea.disabled = false;
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="audio-lines"></i>';
                    lucide.createIcons();

                    if (isOnChatPage && chatMessages) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
            }
        };

        submitBtn.addEventListener('click', handleSubmit);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        });
    }

    if (isOnChatPage && chatId) {
        const spaceSelect = document.getElementById('space-select');
        if (spaceSelect) {
            spaceSelect.addEventListener('change', async (e) => {
                const spaceId = e.target.value;

                try {
                    const response = await fetch(`/api/move_chat_to_space/${chatId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ space_id: spaceId ? parseInt(spaceId) : null }),
                    });

                    if (response.status === 401 || response.redirected) {
                        window.location.href = '/login';
                        return;
                    }

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `Server returned ${response.status}`);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Failed to move chat to space');
                    location.reload();
                }
            });
        }
    }

    if (isOnChatPage) {
        const urlParams = new URLSearchParams(window.location.search);
        const queryParam = urlParams.get('q') || urlParams.get('query');
        if (queryParam && textarea && handleSubmit) {
            const queryToSubmit = queryParam;
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            textarea.value = queryToSubmit;
            textarea.dispatchEvent(new Event('input'));
            setTimeout(() => {
                if (textarea && submitBtn && !submitBtn.disabled && handleSubmit) {
                    handleSubmit();
                }
            }, 200);
        }
    }
});
