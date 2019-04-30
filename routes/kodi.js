var express = require('express');
var https = require('https');
var router = express.Router();
const fetch = require('node-fetch');
const EventEmitter = require('events');

var clients = [];
var songid = 0;
var status = "stopped";

//POST
router.post('/play', function(req, res, next) {
    var apiHit = 0;
    var apiHitTime = {};
    var prevHitTime;
    if(req.body.ip!==undefined||req.body.songID!==undefined)
        if(req.body.ip.length)
            for(var ip of req.body.ip) {
                fetch('http://'+ip+':3002/kodiclient/play', {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({timestamp : (new Date()).getTime()+2000, payload: {"jsonrpc":"2.0","method":"player.open", "params": {"item":{"songid":req.body.songID===undefined?843:req.body.songID}}, "id": 0}})
                })
                .then(response => {
                    apiHitTime[response.url] = new Date().getTime()
                    if(apiHit==req.body.ip.length-1) {
                        apiHitTime["difference"] = apiHitTime[response.url] - prevHitTime;
                        clients = req.body.ip;
                        status = "playing";
                        songid = req.body.songID;
                        res.status(200).send({"message": "success", apiHitTime});
                    } else {
                        prevHitTime = apiHitTime[response.url]
                    }
                    apiHit++;
                })
            }
        else
            res.status(400).send({"message": "ip list is empty"})
    else
        res.status(400).send({"message": "ip or songid not specified"})
})

/* Create Queue with Song ID & Play */
router.post('/play_queue', function(req, res, next) {
    var apiHitCounter = 0;
    if(req.body.ip===undefined)
        res.status(400).send({"message": "ip not specified"})
    else
        if(req.body.ip.length===0)
            res.status(400).send({"message": "ip list is empty"})
        else
            if(req.body.songID===undefined)
                res.status(400).send({"message": "songID not specified"})
            else
                if(req.body.song_type===undefined)
                    res.status(400).send({"message": "song_type not specified"})
                else {
                    var timestampAtBegin = new Date().getTime();
                    for(var ip of req.body.ip) {
                        fetch('http://'+ip+':8080/jsonrpc', {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({"jsonrpc":"2.0","method":"Playlist.Clear", "params": {"playlistid": 0}, "id": 0})
                        })
                        .catch(ex => {
                            console.log(ex)
                        })
                        .then(response => {
                            apiHitCounter++;
                            if(req.body.ip.length === apiHitCounter){
                                //reset counter and call fetch after all kodi are hit
                                apiHitCounter=0;
                                for(var ip of req.body.ip) {
                                    fetch('http://'+ip+':8080/jsonrpc', {
                                        method: "POST",
                                        headers: {"Content-Type": "application/json"},
                                        body: JSON.stringify({"jsonrpc":"2.0","method":"Playlist.Add", "params": {"playlistid": 0, item: {"songid": req.body.songID}}, "id": 0})
                                    })
                                    .then(response => {
                                        apiHitCounter++;
                                        if(req.body.ip.length === apiHitCounter){
                                            apiHitCounter=0;
                                            var timestampThen = new Date().getTime();
                                            console.log(timestampThen-timestampAtBegin);
                                            for(var ip of req.body.ip) {
                                                fetch('http://'+ip+':3002/kodiclient/play', {
                                                    method: "POST",
                                                    headers: {"Content-Type": "application/json"},
                                                    body: JSON.stringify({timestamp : (new Date()).getTime()+2000, payload: {"jsonrpc":"2.0","method":"Player.Open", "params": {"item":{"playlistid": 0, "position": 0}}, "id": 0}})
                                                })
                                                .then(response => {
                                                    console.log(new Date().getTime() - timestampThen);
                                                    apiHitCounter++;
                                                    if(req.body.ip.length === apiHitCounter){
                                                        apiHitCounter=0;
                                                        const agent = new https.Agent({
                                                            rejectUnauthorized: false
                                                          })
                                                        /*fetch('https://'+req.body.ip[0]+'/kodi?song_type='+req.body.song_type+'&songid='+req.body.songID, {
                                                            method: "POST",
                                                            agent: agent,
                                                        })
                                                        .then(response => response.json())
                                                        .then(data => {*/
                                                            for(var ip of req.body.ip) {
                                                                for(var songid of [4048, 3591]) {
                                                                    fetch('http://'+ip+':8080/jsonrpc', {
                                                                        method: "POST",
                                                                        headers: {"Content-Type": "application/json"},
                                                                        body: JSON.stringify({"jsonrpc":"2.0","method":"Playlist.Add", "params": {"playlistid": 0, "item": {"songid": songid}}, "id": 0})
                                                                    })
                                                                    .then(response => {
                                                                        apiHitCounter++;
                                                                        if(apiHitCounter===req.body.ip.length*2) {
                                                                            clients = req.body.ip;
                                                                            status = "playing";
                                                                            songid = req.body.songID;
                                                                            res.status(200).send({"message": "success"});
                                                                        }
                                                                    })
                                                                }
                                                            }
                                                        //})
                                                    }
                                                })
                                            }
                                        }
                                    })
                                }
                            }
                        })
                    }
                }
})

/* Play Previous Song in Queue */
router.get('/prev', function(req, res, next) {
    const myEmitter = new EventEmitter();
    var currentPosition;
    if(status==="stopped")
        res.status(400).send({"message": "multiroom not playing"})
    else {

        var apiHitCounter = 0;
        fetch('http://'+clients[0]+':8080/jsonrpc', {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                "jsonrpc": "2.0", "method": "Player.GetProperties", "params": {"playerid": 0, "properties": ["playlistid","position"]},"id":0
            })
        })
        .then(response => response.json())
        .then(data => {
            currentPosition = data.result.position;
            myEmitter.emit('gotPlayerProps');
        })

        myEmitter.on('gotPlayerProps', () => {
            if(currentPosition>0) {
                var currentTimestamp = new Date().getTime();
                for(var ip of clients) {
                    fetch('http://'+ip+':3002/kodiclient/prev', {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({timestamp: currentTimestamp+2000, position: currentPosition})
                    })
                    .then(response => {
                        apiHitCounter++;
                        if(apiHitCounter===clients.length) {
                            res.send({"message": "success"});
                        }
                    })
                }
            } else {
                res.status(400).send({"message": "Playing first song of playlist, cannot goto previous song"});
            }
        })
    }
})

/* Play Next Song in Queue */
router.get('/next', function(req, res, next) {
    const myEmitter = new EventEmitter();
    var currentPosition;
    var playlistLength;
    if(status==="stopped")
        res.status(400).send({"message": "multiroom not playing"})
    else {
        var apiHitCounter = 0;
        fetch('http://'+clients[0]+':8080/jsonrpc', {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                "jsonrpc": "2.0", "method": "Player.GetProperties", "params": {"playerid": 0, "properties": ["playlistid","position"]},"id":0
            })
        })
        .then(response => response.json())
        .then(data => {
            apiHitCounter++;
            currentPosition = data.result.position;
            if(apiHitCounter===2) {
                myEmitter.emit('gotPlayerProps');
            }
        })
        fetch('http://'+clients[0]+':8080/jsonrpc', {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                "jsonrpc": "2.0", "method": "Playlist.GetItems", "params": {"playlistid": 0},"id":0
            })
        })
        .then(response => response.json())
        .then(data => {
            apiHitCounter++;
            playlistLength = data.result.limits.end;
            if(apiHitCounter===2){
                myEmitter.emit('gotPlayerProps');
            }
        })
        myEmitter.on('gotPlayerProps', () => {
            if(currentPosition<playlistLength-1) {
                apiHitCounter = 0;
                var currentTimestamp = new Date().getTime();
                for(var ip of clients) {
                    fetch('http://'+ip+':3002/kodiclient/next', {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({timestamp: currentTimestamp+2000, position: currentPosition})
                    })
                    .then(response => {
                        apiHitCounter++;
                        if(apiHitCounter===clients.length) {
                            res.send({"message": "success"});
                        }
                    })
                }
            } else {
                res.status(400).send({"message": "Playing last song of playlist, cannot goto next song"});
            }
        })
    }
})

/* Add Songs to the Queue */
router.post('/enqueue', function(req, res, next) {
    if(req.body.songs.length===0)
        res.status(400).send({"message": "Song list is empty"})
    else {
        var apiHitCounter = 0;
        for(var songID of req.body.songs) {
            for(var ip of clients) {
                fetch('http://'+ip+':8080/jsonrpc', {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({"jsonrpc":"2.0","method":"Playlist.Add", "params": {"playlistid": 0, "item": {"songid": songID}}, "id": 0})
                })
                .then(response => {
                    apiHitCounter++;
                    if(apiHitCounter===req.body.songs.length*clients.length) {
                        res.send({"message": "success"})
                    }
                })
            }
        }
    }
})

router.get('/status', function(req, res, next) {
    res.status(200).send({"clients": clients, "songid": songid, "status": status})
})

router.post('/change', function(req, res, next) {
    
    var seekTimeStamp = new Date().getTime()
    //find new and deleted elements
    var insertedIP = [];
    var removedIP = []
    for(var reqIP of req.body.ip) {
        if(!clients.includes(reqIP))
            insertedIP.push(reqIP)
    }
    for(var clientIP of clients) {
        if(!req.body.ip.includes(clientIP))
            removedIP.push(clientIP)
    }
    var apiHitCounter = 0
    if(removedIP.length !== 0) {
        for(var ip of removedIP) {
            fetch('http://'+ip+':8080/jsonrpc', {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({"jsonrpc":"2.0","method":"player.stop", "params": { "playerid": 0 }, "id": 0})
            })
            .then(response => {
                apiHitCounter++;
                if(apiHitCounter===removedIP.length) {
                    if(insertedIP.length === 0) {
                        status = "playing"
                        clients = req.body.ip
                        res.status(200).send({"message": "success"});
                    } else {
                        res.status(500).send({"message": "Nothing done"});
                    }
                }
            })
        }
    } else {
        if(insertedIP.length !== 0) {
            for(var ip of insertedIP) {
                fetch('http://'+ip+':8080/jsonrpc', {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({"jsonrpc":"2.0","method":"player.open", "params": {"item":{"songid":songid===undefined?843:songid}}, "id": 0})
                })
                .then(response => {
                    apiHitCounter++;
                    if(apiHitCounter===insertedIP.length) {
                        fetch('http://'+clients[0]+':8080/jsonrpc', {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({"jsonrpc":"2.0","method":"Player.GetProperties","params":{"playerid":0,"properties":["time"]},"id":0})
                        })
                        .then(response => response.json())
                        .catch(ex => {debugger;})
                        .then(seekData => {
                            status = "playing"
                            var currentTimeStamp = new Date().getTime()
                            var seekTime = seekData.result.time

                            clients = req.body.ip
                            for(var ip of clients) {
                                fetch('http://'+ip+':3002/kodiclient/seek', {
                                    method: "POST",
                                    headers: {"Content-Type": "application/json"},
                                    body: JSON.stringify({timestamp: currentTimeStamp, seekTime: seekTime})
                                })
                                .then(response => {

                                    apiHitCounter++;
                                    if(apiHitCounter===insertedIP.length+clients.length) {
                                        res.status(200).send({"message": "success"});
                                    }
                                })
                            }
                        })
                    }
                })
            }
        } else {
            res.status(400).send({"message": "IP list not changed"})
        }
    } 
})

router.post('/seek', function(req, res, next) {
    if(req.body.time!==undefined) {
        if(status!=="stopped") {
            var apiHitCounter = 0;
            var currentTimeStamp = new Date().getTime();
            for(var ip of clients) {
                fetch('http://'+ip+':3002/kodiclient/seek', {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        timestamp: currentTimeStamp, seekTime: req.body.time
                    })
                })
                .then(response => {
                    if(apiHitCounter===clients.length-1) {
                        res.status(200).send({"message": "success"});
                    }
                    apiHitCounter++;
                })
            }
        }
        else {
            res.status(400).send({"message": "multiroom not playing"})
        }
    } else {
        res.status(400).send({"message": "time not defined"})
    }
})

router.get('/stop', function(req, res, next) {
    var apiHit = 0;
    if(status!=="stopped")
        for(var ip of clients) {
            fetch('http://'+ip+':8080/jsonrpc', {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({"jsonrpc":"2.0","method":"player.stop", "params": { "playerid": 0 }, "id": 0})
            })
            .then(response => {
                if(apiHit===clients.length-1) {
                    status = "stopped"
                    clients = []
                    res.status(200).send({"message": "success"});
                }
                apiHit++;
            })
        }
    else
        res.status(200).send({"message": "Multiroom already stopped"})
})

router.get('/time', function(req, res, next) {
    var apiHit = 0;
    var apiHitTime = {};
    fetch('http://192.168.0.4:8080/jsonrpc', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"jsonrpc":"2.0","method":"Player.GetProperties","params":{"playerid":0,"properties":["percentage"]},"id":0})
    })
    .then(response => response.json())
    .then(data => {
        apiHitTime["four"] = data.result.percentage;
        if(apiHit==1) {
            apiHitTime["difference"] = apiHitTime["four"] - apiHitTime["ninety"];
            res.status(200).send({"message": "success", apiHitTime})
        }
        apiHit++;
    })

    fetch('http://192.168.0.90:8080/jsonrpc', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"jsonrpc":"2.0","method":"Player.GetProperties","params":{"playerid":0,"properties":["percentage"]},"id":0})
    })
    .then(response => response.json())
    .then(data => {
        apiHitTime["ninety"] = data.result.percentage;
        if(apiHit==1) {
            apiHitTime["difference"] = apiHitTime["four"] - apiHitTime["ninety"];
            res.status(200).send({"message": "success", apiHitTime})
        }
        apiHit++;
    })
})

/* Play Pause all Multiroom Clients */
router.get('/playpause', function(req, res, next)  {
    var apiHitCounter = 0;
    if(status==="playing") {
        var timestamp = new Date().getTime() + 2000;
        for( var ip of clients ) {
            fetch("http://"+ip+":3002/kodiclient/playpause", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({timestamp: timestamp})
            })
            .then( response => response.json())
            .then( data => {
                if(data.message === "success") {
                    apiHitCounter++;
                    if(apiHitCounter===clients.length) {
                        status = 'playing';;
                        res.status(200).send({"message": "success"});
                    }
                } else {
                    status = "stopped";
                    clients = [];
                    res.status(500).send({"message": "failure"})
                }
            })
        }
    } else {
        res.send({"message": "multiroom not playing"})
    }
})

/* Ignore all GET requests */
router.get('/*', function(req, res, next) {
    res.status(400).send({"message": "GET not Supported on this method"})
});

module.exports = router;
