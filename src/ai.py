import ollama
import requests
from flask import current_app
from html.parser import HTMLParser
import re
import json
import os
from bs4 import BeautifulSoup


class AIService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        import os

        ollama_host = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_client = ollama.Client(host=ollama_host)

        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    def parse_searxng_html(self, html_content):
        results = []
        try:
            soup = BeautifulSoup(html_content, "html.parser")

            result_divs = soup.select("article.result")
            
            if not result_divs:
                selectors = [
                    "article.result-default",
                    'article[class*="result"]',
                    "div.result",
                    ".result",
                ]
                for selector in selectors:
                    result_divs = soup.select(selector)
                    if result_divs:
                        break

            if not result_divs:
                all_links = soup.find_all("a", href=True)
                for link in all_links[:20]:
                    href = link.get("href", "")
                    if href and href.startswith("http") and "searx" not in href.lower():
                        title = link.get_text(strip=True)
                        if title and len(title) > 5:
                            try:
                                from urllib.parse import urlparse

                                parsed = urlparse(href)
                                if parsed.netloc:
                                    favicon = (
                                        f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
                                    )
                                    content = ""
                                    parent = link.parent
                                    if parent:
                                        sibling = parent.find_next_sibling(
                                            ["p", "span", "div"]
                                        )
                                        if sibling:
                                            content = sibling.get_text(strip=True)[:200]
                                    results.append(
                                        {
                                            "title": title[:200],
                                            "url": href,
                                            "content": content,
                                            "favicon": favicon,
                                        }
                                    )
                                    if len(results) >= 5:
                                        break
                            except:
                                continue

            for result_div in result_divs[:15]:
                try:
                    title = ""
                    url = ""
                    content = ""
                    favicon = ""

                    url_header = result_div.find("a", class_="url_header")
                    if url_header:
                        url = url_header.get("href", "")

                    h3 = result_div.find("h3")
                    if h3:
                        title_link = h3.find("a", href=True)
                        if title_link:
                            title = title_link.get_text(strip=True)
                            if not url:
                                url = title_link.get("href", "")
                        else:
                            title = h3.get_text(strip=True)

                    if not url:
                        link_elem = result_div.find("a", href=True)
                        if link_elem:
                            url = link_elem.get("href", "")

                    content_elem = result_div.find("p", class_="content")
                    if content_elem:
                        content = content_elem.get_text(strip=True)
                        if content == "This site did not provide any description.":
                            content = ""
                    
                    if not content:
                        content_elem = (
                            result_div.find("p", class_="result-content")
                            or result_div.find("span", class_="content")
                            or result_div.find("div", class_="content")
                            or result_div.find("p", class_="snippet")
                        )
                        if content_elem:
                            content = content_elem.get_text(strip=True)

                    if not content:
                        all_text = result_div.get_text(separator=" ", strip=True)
                        if title and title in all_text:
                            all_text = all_text.replace(title, "", 1).strip()
                        if url and url in all_text:
                            all_text = all_text.replace(url, "", 1).strip()
                        if len(all_text) > 30:
                            content = all_text[:300].strip()

                    if url:
                        if url.startswith("//"):
                            url = "https:" + url
                        elif url.startswith("/"):
                            continue
                        elif not url.startswith("http"):
                            continue
                        elif "searx" in url.lower() or "searxng" in url.lower():
                            continue

                    if url and url.startswith("http"):
                        try:
                            from urllib.parse import urlparse

                            parsed = urlparse(url)
                            if parsed.netloc:
                                favicon = (
                                    f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
                                )
                        except:
                            pass

                    if url and url.startswith("http") and title:
                        results.append(
                            {
                                "title": title[:200] or "Untitled",
                                "url": url,
                                "content": content[:500] if content else "",
                                "favicon": favicon,
                            }
                        )

                        if len(results) >= 10:
                            break
                except Exception:
                    continue
        except Exception:
            pass

        return results[:10]

    def search(self, query, searxng_host):
        if not query:
            return []

        searxng_instances = [
            "https://searxng.site/searxng",
            "https://searx.tiekoetter.com",
            "https://searx.prvcy.eu",
            searxng_host,
        ]

        for instance in searxng_instances:
            if not instance:
                continue
            try:
                base_url = instance.rstrip("/")
                if "/searxng" in base_url:
                    url = f"{base_url}/search"
                else:
                    url = f"{base_url}/search"

                params = {"q": query}
                headers = {
                    "User-Agent": self.user_agent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Referer": base_url,
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Upgrade-Insecure-Requests": "1",
                }
                response = requests.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=10,
                    allow_redirects=True,
                )

                if response.status_code in [403, 401, 429]:
                    continue

                if response.status_code != 200:
                    continue

                html_content = response.text
                results = self.parse_searxng_html(html_content)

                if results:
                    return results
            except requests.exceptions.RequestException:
                continue
            except Exception:
                continue

        return []

    def generate_response(
        self,
        query,
        model_name="qwen3-vl:8b",
        chat_context=None,
        search_results=None,
        searxng_host=None,
    ):
        system_prompt = """You are Perplexicat, a helpful AI assistant. You provide accurate, helpful, and concise responses. When search results are provided, prioritize using that information in your response. Use the chat context to maintain conversation continuity.

IMPORTANT: Search results attached to user messages are NOT from the user - they are automatically retrieved web results provided by the system to help you answer. The user's actual question is only the text before the search results section."""

        messages = []

        messages.append({"role": "system", "content": system_prompt})

        if chat_context:
            for message in chat_context:
                role = "user" if message.role == "user" else "assistant"
                messages.append({"role": role, "content": message.content})

        user_content = query
        if search_results:
            search_context = "\n\n---\nSYSTEM-PROVIDED SEARCH RESULTS (not from user):\n"
            for index, result in enumerate(search_results, 1):
                title = result.get("title", "Untitled")
                url = result.get("url", "")
                content = result.get("content", "")
                search_context += f"{index}. {title} ({url})\n"
                if content:
                    search_context += f"   {content}\n"
            user_content = f"{query}\n\n{search_context}"

        messages.append({"role": "user", "content": user_content})

        try:
            response = self.ollama_client.chat(
                model=model_name,
                messages=messages,
            )
            return response.message.content.strip()
        except Exception as exception:
            return f"Error: {str(exception)}"

    def generate_response_stream(
        self,
        query,
        model_name="qwen3-vl:8b",
        chat_context=None,
        search_results=None,
        searxng_host=None,
    ):
        import time
        start_time = time.time()
        
        system_prompt = """You are Perplexicat, a helpful AI assistant. You provide accurate, helpful, and concise responses. When search results are provided, prioritize using that information in your response. Use the chat context to maintain conversation continuity.

IMPORTANT: Search results attached to user messages are NOT from the user - they are automatically retrieved web results provided by the system to help you answer. The user's actual question is only the text before the search results section."""

        messages = []
        messages.append({"role": "system", "content": system_prompt})

        if chat_context:
            recent_context = chat_context[-10:] if len(chat_context) > 10 else chat_context
            for message in recent_context:
                role = "user" if message.role == "user" else "assistant"
                content = message.content[:1500] if len(message.content) > 1500 else message.content
                messages.append({"role": role, "content": content})

        user_content = query
        if search_results:
            search_context = "\n\n---\nSYSTEM-PROVIDED SEARCH RESULTS (not from user):\n"
            for index, result in enumerate(search_results[:3], 1):
                title = result.get("title", "Untitled")[:80]
                url = result.get("url", "")[:80]
                content = result.get("content", "")[:200]
                search_context += f"{index}. {title}\n"
                if content:
                    search_context += f"   {content}\n"
            user_content = f"{query}\n\n{search_context}"

        messages.append({"role": "user", "content": user_content})
        
        try:
            full_response = ""
            import requests
            ollama_host = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
            ollama_url = f"{ollama_host}/api/chat"
            
            payload = {
                "model": model_name,
                "messages": messages,
                "stream": True
            }
            
            http_stream = requests.post(
                ollama_url,
                json=payload,
                stream=True,
                timeout=None
            )
            http_stream.raise_for_status()
            
            yield ""
            
            last_chunk_time = time.time()
            timeout_seconds = 300
            
            for line in http_stream.iter_lines(decode_unicode=True):
                if not line:
                    continue
                    
                try:
                    chunk = json.loads(line)
                except json.JSONDecodeError:
                    continue
                current_time = time.time()
                
                if current_time - last_chunk_time > timeout_seconds:
                    yield "\n\n[Stream timeout after {timeout_seconds} seconds]"
                    break

                if chunk:
                    last_chunk_time = current_time
                    
                    chunk_text = None
                    thinking_text = None
                    
                    try:
                        if isinstance(chunk, dict):
                            message = chunk.get("message", {})
                            if isinstance(message, dict):
                                chunk_text = message.get("content") or None
                                thinking_text = message.get("thinking") or None
                            if chunk.get("done", False):
                                break
                    except Exception:
                        continue
                    
                    if chunk_text:
                        full_response += chunk_text
                        yield {"type": "content", "text": chunk_text}
                    elif thinking_text:
                        yield {"type": "thinking", "text": thinking_text}

                    done = False
                    if isinstance(chunk, dict):
                        done = chunk.get("done", False)
                    elif hasattr(chunk, "done"):
                        done = chunk.done
                    
                    if done:
                        break

            return full_response.strip()
        except Exception as exception:
            yield f"Error: {str(exception)}"
            return f"Error: {str(exception)}"


ai_service = AIService()