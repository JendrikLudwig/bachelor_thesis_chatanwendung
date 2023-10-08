const logic = require("./functions/server")

let express = require('express');
let app = express();
let expressWs = require('express-ws')(app);


const PORT = 3088
const SEC_TOKEN = "VJ9YCPLidZclyuBfRXc7RhPp8dFj7f"

let connected_clients = {} // --- Change zu Objekt
let id_counter = 0




//Header: auth_key, username

app.use("/static",express.static(__dirname + "/static"))

app.get('/', (req, res) => {
    res.sendFile('routes/index.html', {root: __dirname })
})




app.get('/js_chat', (req, res) => {
    res.sendFile('routes/javascript.html', {root: __dirname })
})

app.get('/ps_chat', (req, res) => {
    res.sendFile('routes/pyscript.html', {root: __dirname })
})

app.get('/chat/:page/:ammount', (req, res) => {
    const data = logic.getLastMessages(0,100)
    res.send(data)
})





app.ws('/', function(ws, req) {
    const params = req.query

    //Connection Validation
    if(!logic.auth(ws, params, SEC_TOKEN)) return false
    
    //ID zuweisung
    ws.id = ++id_counter
    
    logic.userConfig(ws, req, connected_clients) 
    //Broadcast new User Join
    logic.userJoin(ws, params, connected_clients) 
       
    ws.on('message', function(msg) {

        //Template Incomming Message
        const ic_msg = {
            client_timestamp: Date.now(),
            content: {
                type:"text",
                data:"Lorem Ipsum..." 
            }
        }
        //Message Validation
        if(!logic.msg_validate(ws, msg, connected_clients)) return false

        const MSG_JSON = JSON.parse(msg)

        //Outgoing Message
        let message = {
            uuid: logic.createID(),
            timestamp: Date.now(),
            type:"message", 
            content: MSG_JSON.content,
            user:{
                id:ws.id,
                name: params.name
            },
            room_info:{
                users:logic.usercount(connected_clients),
            }
        }

        console.log(message);

        logic.broadcast(connected_clients, message)
    });


    ws.on('close', function() {
        //Broadcast User left Chat Room
        logic.userLeave(ws, params, connected_clients)
        console.log("Client getrennt!");
    });


});

app.listen(PORT, () => {
    console.log(`Chatbackend aktiv auf Port ${PORT}`)
})



