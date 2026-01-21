import ollama
import requests
from flask import current_app
from html.parser import HTMLParser
import re
import json
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

            result_divs = []
            selectors = [
                "article.result",
                "div.result",
                "div.result-default",
                'div[class*="result"]',
                'article[class*="result"]',
                ".result",
                "div.result-header",
                "div.result-content",
            ]

            for selector in selectors:
                result_divs = soup.select(selector)
                if result_divs:
                    print(
                        f"Found {len(result_divs)} results using selector: {selector}"
                    )
                    break

            if not result_divs:
                all_links = soup.find_all("a", href=True)
                print(f"No result divs found, trying all links: {len(all_links)}")
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
                    title_elem = None
                    link_elem = None
                    content_elem = None

                    title_elem = (
                        result_div.find("h3")
                        or result_div.find("h4")
                        or result_div.find("h2")
                        or result_div.find("a", class_="result-title")
                        or result_div.find("a", class_="title")
                        or result_div.find("h3", class_="result_title")
                        or result_div.find("h4", class_="result_title")
                        or result_div.find("a", href=True)
                    )

                    link_elem = (
                        result_div.find("a", href=True, class_="url")
                        or result_div.find("a", href=True, class_="result-url")
                        or result_div.find("a", href=True, class_="result-link")
                        or result_div.find("a", href=True)
                    )

                    if title_elem and not link_elem and title_elem.name == "a":
                        link_elem = title_elem
                    elif title_elem and not link_elem:
                        link_elem = title_elem.find("a", href=True)

                    content_elem = (
                        result_div.find("p", class_="content")
                        or result_div.find("p", class_="result-content")
                        or result_div.find("span", class_="content")
                        or result_div.find("div", class_="content")
                        or result_div.find("p", class_="snippet")
                        or result_div.find("p", class_="description")
                        or result_div.find("span", class_="snippet")
                        or result_div.find("div", class_="snippet")
                        or result_div.find("p")
                    )

                    title = ""
                    url = ""
                    content = ""
                    favicon = ""

                    if title_elem:
                        if title_elem.name == "a":
                            title = title_elem.get_text(strip=True)
                            if not url:
                                url = title_elem.get("href", "")
                        else:
                            title_link = title_elem.find("a", href=True)
                            if title_link:
                                title = title_link.get_text(strip=True)
                                if not url:
                                    url = title_link.get("href", "")
                            else:
                                title = title_elem.get_text(strip=True)

                    if link_elem and not url:
                        url = link_elem.get("href", "")
                        if not url and link_elem.get("data-url"):
                            url = link_elem.get("data-url", "")

                    if url:
                        if url.startswith("//"):
                            url = "https:" + url
                        elif url.startswith("/"):
                            continue
                        elif not url.startswith("http"):
                            continue
                        elif "searx" in url.lower() or "searxng" in url.lower():
                            continue

                    if content_elem:
                        content = content_elem.get_text(strip=True)

                    if not content:
                        all_text = result_div.get_text(separator=" ", strip=True)
                        if title and title in all_text:
                            all_text = all_text.replace(title, "", 1).strip()
                        if len(all_text) > 30:
                            content = all_text[:300].strip()

                    if url and url.startswith("http") and title:
                        try:
                            from urllib.parse import urlparse

                            parsed = urlparse(url)
                            if parsed.netloc:
                                favicon = (
                                    f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
                                )
                        except:
                            pass

                        results.append(
                            {
                                "title": title[:200] or "Untitled",
                                "url": url,
                                "content": content[:500] if content else "",
                                "favicon": favicon,
                            }
                        )

                        if len(results) >= 5:
                            break
                except Exception as e:
                    print(f"Error parsing result: {e}")
                    continue
        except Exception as e:
            print(f"HTML parsing error: {e}")
            import traceback

            traceback.print_exc()

        print(f"Parsed {len(results)} results from HTML")
        for i, result in enumerate(results[:5], 1):
            print(
                f"  Result {i}: title='{result.get('title', '')[:50]}', url='{result.get('url', '')[:50]}'"
            )
        return results[:5]

    def search(self, query, searxng_host):
        if not query:
            print(f"Search skipped: no query")
            return []

        print(f"Starting search for: {query}")

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
                print(f"Trying SearXNG HTML: {url}?q={query}")
                response = requests.get(
                    url,
                    params=params,
                    headers=headers,
                    timeout=10,
                    allow_redirects=True,
                )

                print(f"Response status: {response.status_code} from {url}")

                if response.status_code in [403, 401, 429]:
                    print(f"Access denied (status {response.status_code}) from {url}")
                    continue

                if response.status_code != 200:
                    print(f"Non-200 status ({response.status_code}) from {url}")
                    continue

                html_content = response.text
                print(f"Got HTML response from {url}, parsing...")
                print(f"HTML length: {len(html_content)} characters")

                if len(html_content) < 1000:
                    print(f"HTML content preview: {html_content[:500]}")

                results = self.parse_searxng_html(html_content)

                if results:
                    print(f"Returning {len(results)} search results from HTML parsing")
                    return results
                else:
                    print(f"No results found in HTML from {url}")
            except requests.exceptions.RequestException as e:
                print(f"Request exception for {instance}: {e}")
                continue
            except Exception as e:
                print(f"Unexpected error for {instance}: {e}")
                import traceback

                traceback.print_exc()
                continue

        print("No search results found from any source")
        return []

    def generate_response(
        self,
        query,
        model_name="gemma3:4b",
        chat_context=None,
        search_results=None,
        searxng_host=None,
    ):
        system_prompt = """You are Perplexicat, a helpful AI assistant. You provide accurate, helpful, and concise responses. When search results are provided, prioritize using that information in your response. Use the chat context to maintain conversation continuity."""

        messages = []

        messages.append({"role": "system", "content": system_prompt})

        if chat_context:
            for msg in chat_context:
                role = "user" if msg.role == "user" else "assistant"
                messages.append({"role": role, "content": msg.content})

        user_content = query
        if search_results:
            search_context = "\n\nSearch results (prioritize this information):\n"
            for idx, result in enumerate(search_results, 1):
                title = result.get("title", "Untitled")
                url = result.get("url", "")
                content = result.get("content", "")
                search_context += f"{idx}. {title} ({url})\n"
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
            print(f"Error in generation: {exception}")
            return f"Error: {str(exception)}"

    def generate_response_stream(
        self,
        query,
        model_name="gemma3:4b",
        chat_context=None,
        search_results=None,
        searxng_host=None,
    ):
        """Generate response with streaming support - yields chunks as they arrive"""
        system_prompt = """You are Perplexicat, a helpful AI assistant. You provide accurate, helpful, and concise responses. When search results are provided, prioritize using that information in your response. Use the chat context to maintain conversation continuity."""

        messages = []

        messages.append({"role": "system", "content": system_prompt})

        if chat_context:
            for msg in chat_context:
                role = "user" if msg.role == "user" else "assistant"
                messages.append({"role": role, "content": msg.content})

        user_content = query
        if search_results:
            search_context = "\n\nSearch results (prioritize this information):\n"
            for idx, result in enumerate(search_results, 1):
                title = result.get("title", "Untitled")
                url = result.get("url", "")
                content = result.get("content", "")
                search_context += f"{idx}. {title} ({url})\n"
                if content:
                    search_context += f"   {content}\n"
            user_content = f"{query}\n\n{search_context}"

        messages.append({"role": "user", "content": user_content})

        try:
            full_response = ""
            stream = self.ollama_client.chat(
                model=model_name,
                messages=messages,
                stream=True,
            )

            for chunk in stream:
                if chunk and hasattr(chunk, "message"):
                    chunk_text = (
                        chunk.message.content
                        if hasattr(chunk.message, "content")
                        else None
                    )
                    if chunk_text:
                        full_response += chunk_text
                        yield chunk_text

                if hasattr(chunk, "done") and chunk.done:
                    break

            return full_response.strip()
        except Exception as exception:
            print(f"Error in streaming generation: {exception}")
            yield f"Error: {str(exception)}"
            return f"Error: {str(exception)}"


ai_service = AIService()
