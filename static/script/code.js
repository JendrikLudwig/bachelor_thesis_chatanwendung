//DISPLAY Performance-Measure-Values
//DEBUG Show Performance Measures
const PERF = {
    APPLICATION_SETUP: true,
    WEBSOCKET_DURATION: true,
    SEND_MESSAGES_DURATION: true,
    RECEIVE_MESSAGES_DURATION: true,
    FETCH_OLD_MESSAGES_DURATION: true,
    PLACE_NEW_DOM_DURATION: true
}

if (PERF.APPLICATION_SETUP) console.log([";application_setup_start", performance.now(), ].join(";"))

//Performance_Parameter
let message_counter = -1

let clientInfo = {};
let htmlContent = [];

let chat_open = false

const MESSAGE_BUFFER_SIZE = 500



function getQueryParameters() {
    const queryParameters = {};
    const queryString = window.location.search.substring(1);
    const parameters = new URLSearchParams(queryString);

    for (const [key, value] of parameters.entries()) {
        queryParameters[key] = decodeURIComponent(value);
    }

    return queryParameters;
}

async function msghandleConfig(data) {
    clientInfo = data.user;
    getLatestMessages(0, 0);
    return true;
}


function msghandleError(data) {
    // Handling of error messages (Unused)
}

async function onMessage(event, oldData = false) {
    const t1 = performance.now()

    try {
        let html = {};
        let message = {};

        if (typeof event.data === "string") {
            message = JSON.parse(event.data);
        } else {
            message = event
        }

        const msgType = message.type;
        if (msgType === 'config') {
            await msghandleConfig(message);
            updateOnline(message.room_info.users);
            return true;
        }


        if (!oldData && (Object.keys(clientInfo).length === 0 || !chat_open)) {
            return false;
        }



        updateOnline(message.room_info.users);

        message_counter++
        switch (msgType) {
            case 'message':
                html = textMessageHTML(message.user, message.timestamp, message.content);
                break;
            case 'join':
                html = joinHTML(message.user, message.timestamp);
                break;
            case 'leave':
                html = leaveHTML(message.user, message.timestamp);
                break;
            case 'error':
                msghandleError(message);
                break;
        }


        const html_data_json = {
            "uuid": message.uuid,
            "timestamp": message.timestamp,
            "html": html
        }


        if (oldData) {
            return html_data_json;
        } else {
            htmlContent.push(html_data_json);
            updateChatCanvas();
        }


    } catch (e) {
        console.error(e);
    }
    const t2 = performance.now()
    if (PERF.RECEIVE_MESSAGES_DURATION) console.log([";receive_messages_duration", t1, t2, t2 - t1, "Recieved_messages: " + message_counter].join(";"))

}

function connectWebSocket(url, token, name) {
    const connectionURL = `ws://${url}/?token=${token}&name=${name}`;
    const socket = new WebSocket(connectionURL);
    socket.addEventListener('message', event => onMessage(event));
    socket.addEventListener('close', () => window.location.href = '/');
    return socket;
}


function updateOnline(count) {
    const counterDiv = document.getElementById('online_count');
    counterDiv.innerText = count + ' Online';
    return true;
}

function convertTimestamp(ts) {
    const time = new Date(ts);
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function deleteLoader() {
    const loaderDiv = document.getElementById('loader');
    loaderDiv.remove();
    if (PERF.APPLICATION_SETUP) console.log([";application_setup_end", performance.now(), ].join(";"))
    chat_open = true

}

function clean_messages() {
    let filtered_uuids = []
    let buffer_length = htmlContent.length
    if (buffer_length >= MESSAGE_BUFFER_SIZE) {
        const DIFF = buffer_length - 500
        htmlContent.splice(0, DIFF)
    }

    htmlContent.forEach((obj, index) => {
        let uuid = obj.uuid

        if (filtered_uuids.includes(uuid)) {
            htmlContent.splice(index, 1);
        } else {
            filtered_uuids.push(uuid);
        }        
    });

    htmlContent.sort((a, b) => a.timestamp - b.timestamp);
}

function updateChatCanvas() {
    const t1 = performance.now()
    clean_messages() //html_content array sortieren
    const html = htmlContent.map(x => {
        return x.html
    }).join('\n');

    const t2 = performance.now()
    const contentBox = document.getElementById('content_box');
    contentBox.innerHTML = html;
    const t3 = performance.now()

    scrollBottom();
    const t4 = performance.now()
    if (PERF.PLACE_NEW_DOM_DURATION) console.log([";dom_update_duration", t1, t2, t3, t4, t4 - t1, t3 - t2].join(";"))


}


async function getLatestMessages(page, amount) {
    const t1 = performance.now()
    const html = [];
    const baseURL = 'http://' + window.location.host;
    const response = await fetch(`${baseURL}/chat/0/0`);
    const jsonData = await response.json();

    const t2 = performance.now()

    for (const msg of jsonData) {
        html.push(await onMessage(msg, true));
    }

    htmlContent = htmlContent.concat(html);
    const t3 = performance.now()

    updateChatCanvas();
    deleteLoader()
    const t4 = performance.now()

    if (PERF.FETCH_OLD_MESSAGES_DURATION) console.log([";fetch_old_messages", t1, t2, t3, t4, t4 - t1, t3 - t2].join(";"))


}

function joinHTML(user, timestamp) {
    let html = '';
    if (clientInfo.id === user.id) {
        html = `
            <div id="message_container" class="received">
                <div class="avatar">
                    <img src="static/join.png">
                </div>
                <div class="flex-col">
                    <p class="bubble-data">${convertTimestamp(timestamp)}<span class="username"> - Du hast den Chat betreten.</span></p>
                </div>
            </div>
        `;
    } else {
        html = `
            <div id="message_container" class="received">
                <div class="avatar">
                    <img src="static/join.png">
                </div>
                <div class="flex-col">
                    <p class="bubble-data">${convertTimestamp(timestamp)}<span class="username"> - ${user.name} hat den Chat betreten.</span></p>
                </div>
            </div>
        `;
    }
    return html;
}

function leaveHTML(user, timestamp) {
    const html = `
        <div id="message_container" class="received">
            <div class="avatar">
                <img src="static/leave.png">
            </div>
            <div class="flex-col">
                <p class="bubble-data">${convertTimestamp(timestamp)}<span class="username"> - ${user.name} hat den Chat verlassen.</span></p>
            </div>
        </div>
    `;
    return html;
}

function textMessageHTML(user, timestamp, message) {
    let html = '';
    if (clientInfo.id === user.id) {
        html = `
            <div id="message_container" class="sent">
                <div class="flex-col">
                    <div id="speechbubble">${message.data}</div>
                    <p class="bubble-data">${convertTimestamp(timestamp)}</p>
                </div>
            </div>
        `;
    } else {
        html = `
            <div id="message_container" class="recieved">
                ${userAvatarHTML(user)}
                <div class="flex-col">
                    <div id="speechbubble">${message.data}</div>
                    <p class="bubble-data">${convertTimestamp(timestamp)}<span class="username"> - ${user.name}</span></p>
                </div>
            </div>
        `;
    }
    return html;
}

function userAvatarHTML(user) {
    function intFromString(string) {
        let sum = 0;
        for (const char of string) {
            sum += char.charCodeAt(0);
        }
        return (sum % 10) + 1;
    }

    const html = `
        <div class="avatar c${intFromString(user.name)}">${user.name[0]}</div>
    `;
    return html;
}


async function sendTextMessage(socket, clickTimeStamp) {

    const t1 = performance.now()

    const inputDiv = document.getElementById('send_input').value;
    if (inputDiv.length === 0) {
        return false;
    }
    document.getElementById('send_input').value = '';
    const timestamp = Date.now();
    const msg = {
        client_timestamp: timestamp,
        content: {
            type: 'text',
            data: inputDiv,
        },
    };
    const msgJSON = JSON.stringify(msg);
    socket.send(msgJSON);

    const t2 = performance.now()

    if (PERF.SEND_MESSAGES_DURATION) console.log([";sending_message_duration", clickTimeStamp, t1, t2, t1 - clickTimeStamp, t2 - t1].join(";"))
}


function scrollBottom() {
    const contentBox = document.getElementById('content_box');
    contentBox.scrollTop = contentBox.scrollHeight;
}