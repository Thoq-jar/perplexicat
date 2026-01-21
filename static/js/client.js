document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const textarea = document.getElementById('search-input');
    const submitBtn = document.getElementById('submit-btn');

    if(textarea && submitBtn) {
        textarea.addEventListener('input', () => {
            if(textarea.value.trim() !== '') {
                submitBtn.innerHTML = '<i data-lucide="arrow-up"></i>';
            } else {
                submitBtn.innerHTML = '<i data-lucide="audio-lines"></i>';
            }
            lucide.createIcons();
        });

        const handleSubmit = async() => {
            const query = textarea.value.trim();
            if(!query) return;

            const modelSelect = document.getElementById('model-select');
            const model = modelSelect ? modelSelect.value : 'microsoft/phi-1_5';

            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({query: query, model: model}),
                });

                if(response.status === 401 || response.redirected) {
                    window.location.href = '/login';
                    return;
                }

                if(!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Server returned ${response.status}`);
                }

                const data = await response.json();
                if(data.chat_id) {
                    window.location.href = `/chat/${data.chat_id}`;
                }
            } catch(error) {
                console.error('Error:', error);
                alert('Something went wrong. Please check if you are logged in.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        };

        submitBtn.addEventListener('click', handleSubmit);

        textarea.addEventListener('keydown', (event) => {
            if(event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
            }
        });
    }
});
