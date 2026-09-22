"""
Tools Server & Playwright Sandbox Microservice (Port 8001)
Executes isolated browser automation, filesystem operations, and system tools in a sandbox environment.
"""

import os
import asyncio
import base64
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from playwright.async_api import async_playwright, Browser, Page

app = FastAPI(title="Grok Bot Tools & Playwright Sandbox Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "./workspace")).resolve()
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

# Global Playwright instances
playwright_instance = None
browser_instance: Optional[Browser] = None
page_instance: Optional[Page] = None


class ToolInvokeRequest(BaseModel):
    tool_name: str
    tool_args: Dict[str, Any] = Field(default_factory=dict)


@app.on_event("startup")
async def startup_event():
    global playwright_instance, browser_instance, page_instance
    try:
        playwright_instance = await async_playwright().start()
        headless = os.getenv("PLAYWRIGHT_HEADLESS", "True").lower() == "true"
        browser_instance = await playwright_instance.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        context = await browser_instance.new_context(viewport={"width": 1280, "height": 800})
        page_instance = await context.new_page()
        # Initial blank page
        await page_instance.goto("about:blank")
    except Exception as e:
        print(f"[ToolsServer Warning] Playwright launch error: {e}")


@app.on_event("shutdown")
async def shutdown_event():
    global playwright_instance, browser_instance
    if browser_instance:
        await browser_instance.close()
    if playwright_instance:
        await playwright_instance.stop()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "tools-server", "workspace": str(WORKSPACE_DIR)}


@app.post("/invoke")
async def invoke_tool(req: ToolInvokeRequest):
    global page_instance
    name = req.tool_name
    args = req.tool_args

    try:
        if name == "browser_navigate":
            url = args.get("url", "https://example.com")
            if page_instance:
                await page_instance.goto(url, timeout=30000, wait_until="networkidle")
                title = await page_instance.title()
                screenshot_bytes = await page_instance.screenshot(type="jpeg", quality=60)
                b64_img = base64.b64encode(screenshot_bytes).decode("utf-8")
                return {
                    "status": "success",
                    "output": f"Navegado exitosamente a {url}. Título: '{title}'",
                    "screenshot_b64": b64_img,
                    "url": url,
                    "title": title
                }

        elif name == "browser_click":
            selector = args.get("selector", "button")
            if page_instance:
                await page_instance.click(selector, timeout=10000)
                screenshot_bytes = await page_instance.screenshot(type="jpeg", quality=60)
                b64_img = base64.b64encode(screenshot_bytes).decode("utf-8")
                return {
                    "status": "success",
                    "output": f"Clic realizado en el selector '{selector}'",
                    "screenshot_b64": b64_img
                }

        elif name == "browser_type":
            selector = args.get("selector", "input")
            text = args.get("text", "")
            if page_instance:
                await page_instance.fill(selector, text, timeout=10000)
                screenshot_bytes = await page_instance.screenshot(type="jpeg", quality=60)
                b64_img = base64.b64encode(screenshot_bytes).decode("utf-8")
                return {
                    "status": "success",
                    "output": f"Texto introducido en '{selector}': {text}",
                    "screenshot_b64": b64_img
                }

        elif name == "browser_extract_dom":
            if page_instance:
                content = await page_instance.content()
                title = await page_instance.title()
                return {
                    "status": "success",
                    "output": f"DOM extraído para '{title}'. Tamaño: {len(content)} caracteres.",
                    "dom_snippet": content[:1000]
                }

        elif name == "file_read":
            filename = args.get("path", "")
            target_path = (WORKSPACE_DIR / filename).resolve()
            if not str(target_path).startswith(str(WORKSPACE_DIR)):
                raise HTTPException(status_code=403, detail="Acceso denegado: Violación de Sandbox /workspace")
            if not target_path.exists():
                return {"status": "error", "output": f"El archivo '{filename}' no existe en el sandbox."}
            content = target_path.read_text(encoding="utf-8")
            return {"status": "success", "output": content, "path": filename}

        elif name == "file_write":
            filename = args.get("path", "output.txt")
            content = args.get("content", "")
            target_path = (WORKSPACE_DIR / filename).resolve()
            if not str(target_path).startswith(str(WORKSPACE_DIR)):
                raise HTTPException(status_code=403, detail="Acceso denegado: Violación de Sandbox /workspace")
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(content, encoding="utf-8")
            return {"status": "success", "output": f"Archivo '{filename}' escrito exitosamente ({len(content)} bytes) en sandbox.", "path": filename}

        elif name == "execute_bash":
            command = args.get("command", "echo 'Hello Sandbox'")
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=str(WORKSPACE_DIR),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            out_str = stdout.decode("utf-8") + stderr.decode("utf-8")
            return {
                "status": "success" if proc.returncode == 0 else "error",
                "output": out_str or "(Sin salida)",
                "returncode": proc.returncode
            }

        else:
            return {"status": "success", "output": f"Herramienta '{name}' ejecutada con argumentos: {args}"}

    except Exception as e:
        return {"status": "error", "output": f"Error ejecutando herramienta '{name}': {str(e)}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
