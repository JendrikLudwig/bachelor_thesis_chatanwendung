let session_messages = []
let user_relevant_messages = []

//Config
const STORE_MESSAGES = true


const createID = () => {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2)).match(/.{1,5}/g).join("-");
}


const getLastMessages = (page, ammount) => {
    //Pages start at 0
    return JSON.stringify(user_relevant_messages.slice(page*ammount,page*ammount+ammount))
    
}


const saveMessage = (message) => {
    session_messages.unshift(message)
    if(!STORE_MESSAGES) return true
    if(!["config","error"].includes(message.type)) {
        user_relevant_messages.unshift(message)
    }

}

const auth = (ws, params, server_token) => {
    
    let client_token = params.token
    let username = params.name

    if (client_token !== server_token || !client_token || !username) {
        ws.close()
        console.log("Client Verbindung abgelehnt!");
        return false
    } 
    console.log("Client verbunden!");


    return true;
}

const broadcast = (connected_clients, message) => {
    saveMessage(message)
    console.log(message);
    const strmsg = JSON.stringify(message)
    Object.entries(connected_clients).forEach(x => {
        x[1].send(strmsg)
    })



}

const userConfig = (ws, req, connected_clients) => {
    connected_clients[ws.id] = ws
    let message = {
        uuid: createID(),
        timestamp: Date.now(),
        type:"config", 
        user:{
            id:ws.id,
            name: req.query.name
        },
        room_info:{
            users:usercount(connected_clients),
        }
    }
    saveMessage(message)
    ws.send(JSON.stringify(message))
}


const userJoin = (ws, params, connected_clients) => {
    let message = {
        uuid: createID(),
        timestamp: Date.now(),
        type:"join", 
        user:{
            id:ws.id,
            name: params.name
        },
        room_info:{
            users:usercount(connected_clients),
        }
    }

    broadcast(connected_clients, message)

}

const userLeave = (ws, params, connected_clients) => {
    delete connected_clients[ws.id]

    let message = {
        uuid: createID(),
        timestamp: Date.now(),
        type:"leave", 
        user:{
            id:ws.id,
            name: params.name
        },
        room_info:{
            users:usercount(connected_clients),
        }
    }

    broadcast(connected_clients, message)

}

const msg_validate = (ws, msg, connected_clients) => {
    try {
        const message = JSON.parse(msg)
        if(!("content" in message)) throw new Error("Content property must be provided!")
        if(message.content.type === "text") if(message.content.data.length == 0) throw new Error("Message should not be empty.")

    } catch (e){
        console.log(e);

        const errmsg = {
            uuid: createID(),
            timestamp: Date.now(),
            type:"error", 
            error:"Invalid message.",
            error_log:e.message,
            room_info:{
                users:usercount(connected_clients)
            }
        }

        saveMessage(errmsg)
        ws.send(JSON.stringify(errmsg))
        return false
    }
    return true

}


const usercount = (connected_clients) => {
    return Object.keys(connected_clients).length
}



module.exports = {
    auth, 
    userConfig, 
    userJoin, 
    userLeave, 
    broadcast, 
    msg_validate,
    usercount,
    getLastMessages,
    createID
}