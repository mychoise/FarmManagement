import socket
import json
import time
import base64
import subprocess
import sys
import os

def capture(url, out_path, scroll_y=0, wait_time=4):
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    ff = subprocess.Popen(['firefox', '--headless', '--marionette', '--window-size=420,920'])
    try:
        time.sleep(2.5)
        s = socket.socket()
        s.connect(('127.0.0.1', 2828))
        
        # Handshake
        data = b""
        while b":" not in data:
            data += s.recv(1)
        l, r = data.split(b":", 1)
        l = int(l)
        m = r
        while len(m) < l:
            m += s.recv(l - len(m))
            
        msg_id = 0
        def send_cmd(name, params):
            nonlocal msg_id
            msg_id += 1
            payload = json.dumps([0, msg_id, name, params])
            encoded = payload.encode('utf-8')
            s.sendall(f"{len(encoded)}:{payload}".encode('utf-8'))
            d = b""
            while b":" not in d:
                d += s.recv(1)
            l, r = d.split(b":", 1)
            l = int(l)
            m = r
            while len(m) < l:
                m += s.recv(l - len(m))
            return json.loads(m.decode('utf-8'))

        send_cmd("WebDriver:NewSession", {"capabilities": {}})
        send_cmd("WebDriver:SetWindowRect", {"width": 420, "height": 920})
        send_cmd("WebDriver:Navigate", {"url": url})
        
        time.sleep(wait_time)
        
        if scroll_y > 0:
            send_cmd("WebDriver:ExecuteScript", {
                "script": f"""
                const els = Array.from(document.querySelectorAll('div')).filter(el => {{
                    const style = window.getComputedStyle(el);
                    return style.overflowY === 'auto' || style.overflowY === 'scroll';
                }});
                if (els.length > 0) {{
                    els[0].scrollTop = {scroll_y};
                }}
                """
            })
            time.sleep(1)
            
        shot = send_cmd("WebDriver:TakeScreenshot", {"full": False})
        b64 = shot[3].get("value")
        if b64:
            with open(out_path, "wb") as f:
                f.write(base64.b64decode(b64))
            print(f"Captured: {out_path} ({len(b64)} bytes)")
        else:
            print("Failed to capture screenshot:", shot)
            
        s.close()
    finally:
        ff.terminate()

if __name__ == '__main__':
    url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8081'
    out_path = sys.argv[2] if len(sys.argv) > 2 else '/tmp/screen.png'
    scroll = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    wait = float(sys.argv[4]) if len(sys.argv) > 4 else 4
    capture(url, out_path, scroll, wait)
