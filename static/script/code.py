#DISPLAY Performance-Measure-Values
#DEBUG Show Performance Measures
perf = {
    "APPLICATION_SETUP":~False,
    "WEBSOCKET_DURATION":~False,
    "SEND_MESSAGES_DURATION":~False,
    "RECEIVE_MESSAGES_DURATION":~False,
    "FETCH_OLD_MESSAGES_DURATION":~False,
    "PLACE_NEW_DOM_DURATION":~False
}

from js import performance, console

if(perf["APPLICATION_SETUP"]):
    console.log(";".join([";application_setup_start",str(performance.now())]))

import asyncio
from pyodide.http import pyfetch, FetchResponse
from js import WebSocket, window
from typing import Optional, Any
from pyodide.ffi import create_proxy
from datetime import datetime
from urllib.parse import parse_qs, unquote
import time
import json


MESSAGE_BUFFER_SIZE = 500


client_info = {}
html_content = []
chat_open = False

message_counter = -1

# Extrahiert die Parameter aus der URL und gibt diese als dict zurück
def get_query_parameters():
    query_params = {}
    query_string = window.location.search[1:]
    parameters = parse_qs(query_string)

    for key, values in parameters.items():
        query_params[key] = unquote(values[0])

    return query_params

# Wird aufgerufen wenn eine config nachricht empfangen wird. 
# Speichert die Config Daten und lädt die letzten Nachrichten vom Server 
async def msghandle_config(data):
    global client_info
    client_info = data["user"]
    asyncio.ensure_future(getLatestMessages(0,0))
    
    return True


# Handling von eingehenden Fehlermeldungen (Unused).
def msghandle_error(data):
    ...
    
# Verarbeitet die eingehenden Nachrichten und lässt den passenden HTML code generieren
# Mit jeder Nachricht wird die DOM Tree aktualisierung ausgelöst.
async def on_message(event, old_data=False):
    t1 = performance.now()
    try:
        html = {}
        message = {}

        if (type(event) is dict):
            message = event
        else:
            message = json.loads(event.data)

        msgtype = message["type"]
        if(msgtype == "config"):
            
            await asyncio.ensure_future(msghandle_config(message))
            update_online(message["room_info"]["users"])
            return 
        
        if(not old_data):
            update_online(message["room_info"]["users"])
            if((len(client_info) == 0) or (not chat_open)):
                return 
        
        
        global message_counter
        message_counter += 1

        match msgtype:
            case "message":
                html = text_message_html(message["user"], message["timestamp"], message["content"])
            case "join":
                html = join_html(message["user"], message["timestamp"])
            case "leave":
                html = leave_html(message["user"], message["timestamp"])
            case "error":
                msghandle_error(message)
        
        html_data_json = {
            "uuid":message["uuid"],
            "timestamp": message["timestamp"],
            "html": html
        }

        if(old_data):
            return html_data_json
        else:
            html_content.append(html_data_json)
            update_chat_canvas()
    except Exception as e:
        print(e)
    t2 = performance.now()
    if(perf["RECEIVE_MESSAGES_DURATION"]):
        console.log(";".join([";receive_messages_duration",str(t1),str(t2),str(t2-t1),"Recieved_messages: "+str(message_counter)]))
    


# Verbindet sich zum Server Websocket.
# Fügt die eventhandler hinzu.
def connect_websocket(url, token, name):
    connection_string = "".join(["ws://",url,"/?","token="+token,"&name="+name])
    socket = WebSocket.new(connection_string)
    socket.addEventListener("message", create_proxy(lambda event: on_message(event)))
    socket.addEventListener("close", create_proxy(lambda event: nav("/")))
    return socket

# Aktualsiert das Online Element im DOM mit der aktuellen Nutzerzahl
def update_online(count):
    counter_div = Element("online_count")
    counter_div.element.innerText = str(count) + " Online"
    return True

# Umrechnung des Server Timestamps in passenden Python Timestamp
def convert_timestamp(ts):
    time = datetime.fromtimestamp(ts/1000)
    def _(n):
        if n < 10:
            result = '%02d' % n
        else:
            result = str(n)
        return result
    time = "{hh}:{mm}".format(hh=_(time.hour),mm=_(time.minute))
    return time

# entfernt den Loader aus dem DOM-Tree
def delete_loader():
    loader_div = Element("loader")
    loader_div.element.remove()
    if(perf["APPLICATION_SETUP"]):
        console.log(";".join([";application_setup_end",str(performance.now())]))
    global chat_open
    chat_open = True
    


def clean_messages():
    global html_content
    filtered_uuids = []
    buffer_length = len(html_content)
    if (buffer_length >= MESSAGE_BUFFER_SIZE): 
        DIFF = buffer_length-500
        del html_content[0:DIFF]
    
    for index, obj in enumerate(html_content):
        uuid = obj["uuid"]

        if(uuid in filtered_uuids):
            del html_content[index]
        else:
            filtered_uuids.append(uuid)
            
    html_content = sorted(html_content, key=lambda x: x['timestamp'])
    


# Aktualisiert den DOM-Tree
def update_chat_canvas():
    t1 = performance.now()
    clean_messages()#html_content array sortieren
    html = "\n".join(list(map(lambda x: x["html"],html_content))) #Nur Html teil aus array filtern.
    loader_div = Element("content_box")
    t2 = performance.now()
    loader_div.element.innerHTML = html
    t3 = performance.now()
    scrollbottom()
    t4 = performance.now()
    if(perf["PLACE_NEW_DOM_DURATION"]):
        console.log(";".join([";dom_update_duration",str(t1),str(t2),str(t3),str(t4),str(t4-t1),str(t3-t2)]))
    

#Desc: Lädt die letzten Nachrichten die im Chat Raum geschickt wurden und fügt diese dem html_content dazu.
#Params: page: Seite des Dateneitnrages, ammount: angefragte Menge
#Return: Nothing.
async def getLatestMessages(page, ammount):
    t1 = performance.now()
    global html_content
    html = []
    baseurl = "http://"+window.location.host
    headers = {"Content-type": "application/json"}
    response = await request(f"{baseurl}/chat/0/0", method="GET", headers=headers)
    json = await response.json()
    t2 = performance.now()

    for msg in json:
        html.append(await asyncio.ensure_future(on_message(msg, old_data=True)))
    html_content = html_content+html
    t3 = performance.now()

    update_chat_canvas()
    delete_loader()
    t4 = performance.now()

    if(perf["FETCH_OLD_MESSAGES_DURATION"]):
        console.log(";".join([";fetch_old_messages",str(t1),str(t2),str(t3),str(t4),str(t4-t1),str(t3-t2)]))

    



# Generiert den HTML-Code für Join-Nachrichten
def join_html(user, timestamp) -> str:
    html = ""
    if(client_info["id"] == user["id"]):
        html = """
            <div id="message_container" class="recieved">
                <div class="avatar">
                    <img src="static/join.png">
                </div>
                <div class="flex-col">
                    <p class="bubble-data">{time}<span class="username"> - Du hast den Chat betreten.</span></p>    
                </div> 
            </div>
        """.format(time=convert_timestamp(timestamp))
    else:
        html = """
            <div id="message_container" class="recieved">
                <div class="avatar">
                    <img src="static/join.png">
                </div>
                <div class="flex-col">
                    <p class="bubble-data">{time}<span class="username"> - {name} hat den Chat betreten.</span></p>    
                </div> 
            </div>
        """.format(time=convert_timestamp(timestamp),name=user["name"])

    output = html
    return output

# Generiert den HTML-Code für Leave-Nachrichten
def leave_html(user, timestamp) -> str:
    html = """
        <div id="message_container" class="recieved">
            <div class="avatar">
                <img src="static/leave.png">
            </div>
            <div class="flex-col">
                <p class="bubble-data">{time}<span class="username"> - {name} hat den Chat verlassen.</span></p>    
            </div> 
        </div>
    """
    output = html.format(time=convert_timestamp(timestamp),name=user["name"])
    return output


# Desc: Gibt HTML für Textnachrichten zurück. Kontrolliert ob Nachricht vom Client oder von anderen Nutzern kommt 
# Params: user: User Objekt aus Message, timestamp: Zeitpunkt der gesendeten Nachricht. message: Textnachricht
# Return: HTML als String
def text_message_html(user, timestamp, message) -> str:
    html = ""

    if(client_info["id"] == user["id"]):
        html = """
            <div id="message_container" class="sent">
    	        <div class="flex-col">
                    <div id="speechbubble">{message}</div>
                    <p class="bubble-data">{time}</p>    
                </div> 
            </div> 
        """.format(message=message["data"],time=convert_timestamp(timestamp))

    else:
        html = """
            <div id="message_container" class="recieved">
                {avatar_html}
    	        <div class="flex-col">
                    <div id="speechbubble">{message}</div>
                    <p class="bubble-data">{time}<span class="username"> - {name}</span></p>    
                </div> 
            </div>
        """.format(avatar_html=user_avatar_html(user),message=message["data"],time=convert_timestamp(timestamp),name=user["name"])
        
    return html


# Erstellt HTML Code für den Avatar eines Users
# Parameter:
#     user: User Objekt aus Message
# Return:
#     HTML als String

def user_avatar_html(user) -> str:
    def int_from_string(string):
        summe = 0
        for char in string:
            summe += ord(char)
        return (summe % 10) + 1

    html = """<div class="avatar c{colorid}">{initial}</div>"""

    output = html.format(colorid=int_from_string(user["name"]),initial=user["name"][0])
    return output

async def send_text_message(socket,clickTimeStamp):
    
    t1 = performance.now()

    input_div = Element("send_input").value
    if(len(input_div) == 0):
        return False
    Element("send_input").clear()
    timestamp = int(round(time.time()*1000))
    msg = {
        "client_timestamp": timestamp,
        "content": {
            "type":"text",
            "data": input_div 
            }
    }
    msg_json = json.dumps(msg)
    socket.send(msg_json)

    t2 = performance.now()
    
    if(perf["SEND_MESSAGES_DURATION"]):
        console.log(";".join([";sending_message_duration",str(clickTimeStamp),str(t1),str(t2),str(t1-clickTimeStamp),str(t2-t1)]))


#------------------
# Fetch Funktion von Pyscript 
#------------------
async def request(url: str, method: str = "GET", body: Optional[str] = None,
                  headers: Optional[dict[str, str]] = None, **fetch_kwargs: Any) -> FetchResponse:
    """
    Async request function. Pass in Method and make sure to await!
    Parameters:
        url: str = URL to make request to
        method: str = {"GET", "POST", "PUT", "DELETE"} from `JavaScript` global fetch())
        body: str = body as json string. Example, body=json.dumps(my_dict)
        headers: dict[str, str] = header as dict, will be converted to string...
            Example, headers=json.dumps({"Content-Type": "application/json"})
        fetch_kwargs: Any = any other keyword arguments to pass to `pyfetch` (will be passed to `fetch`)
    Return:
        response: pyodide.http.FetchResponse = use with .status or await.json(), etc.
    """
    kwargs = {"method": method, "mode": "cors"}  # CORS: https://en.wikipedia.org/wiki/Cross-origin_resource_sharing
    if body and method not in ["GET", "HEAD"]:
        kwargs["body"] = body
    if headers:
        kwargs["headers"] = headers
    kwargs.update(fetch_kwargs)

    response = await pyfetch(url, **kwargs)
    return response


# Scrollt zur neusten Nachricht
def scrollbottom():
    content_box = Element("content_box").element
    content_box.scrollTop = content_box.scrollHeight

# Navigiert zu anderer Page
def nav(loc):
    window.location.href = loc


