var express = require('express');
var router = express.Router();
const fetch = require('node-fetch');

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
                    body: JSON.stringify({timestamp : (new Date()).getTime()+10000, payload: {"jsonrpc":"2.0","method":"player.open", "params": {"item":{"songid":req.body.songID===undefined?843:req.body.songID}}, "id": 0}})
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
    /*fetch('http://192.168.0.4:8080/jsonrpc', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"jsonrpc":"2.0","method":"player.open", "params": {"item":{"songid":req.query.songid===undefined?843:req.query.songid}}, "id": 0})
    })
    .then(response => response.json())
    .then(data => {
        apiHitTime["four"] = new Date().getTime()
        if(apiHit==1) {
            apiHitTime["difference"] = apiHitTime["four"] - apiHitTime["ninety"];
            res.status(200).send({"message": "success", apiHitTime});
        }
        apiHit++;
    })

    fetch('http://192.168.0.90:8080/jsonrpc', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"jsonrpc":"2.0","method":"player.open", "params": {"item":{"songid":req.query.songid===undefined?843:req.query.songid}}, "id": 0})
    })
    .then(response => response.json())
    .then(data => {
        apiHitTime["ninety"] = new Date().getTime()
        if(apiHit==1) {
            apiHitTime["difference"] = apiHitTime["four"] - apiHitTime["ninety"];
            res.status(200).send({"message": "success", apiHitTime})
        }
        apiHit++;
    })*/
})

router.get('/status', function(req, res, next) {
    res.status(200).send({"clients": clients, "songid": songid, "status": status})
})

router.post('/change', function(req, res, next) {
    console.log(clients[0]);
    fetch('http://'+clients[0]+':8080/jsonrpc', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"jsonrpc":"2.0","method":"Player.GetProperties","params":{"playerid":0,"properties":["time"]},"id":0})
    })
    .then(response => response.json())
    .catch(ex => {debugger;})
    .then(seekData => {
        var seekTime = seekData.result.time;

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
        for(var ip of removedIP) {
            fetch('http://'+ip+':8080/jsonrpc', {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({"jsonrpc":"2.0","method":"player.stop", "params": { "playerid": 0 }, "id": 0})
            })
            .then(response => {
                if(apiHitCounter===removedIP.length+insertedIP.length-1) {
                    status = "playing"
                    clients = req.body.ip
                    res.status(200).send({"message": "success"});
                }
                apiHitCounter++;
            })
        }
        for(var ip of insertedIP) {
            fetch('http://'+ip+':8080/jsonrpc', {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({"jsonrpc":"2.0","method":"player.open", "params": {"item":{"songid":songid===undefined?843:songid}}, "id": 0})
            })
            .then(response => {
                if(apiHitCounter===removedIP.length+insertedIP.length-1) {
                    status = "playing"
                    clients = req.body.ip
                    for(var ip of insertedIP) {
                        fetch('http://'+ip+':8080/jsonrpc', {
                            method: "POST",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({"jsonrpc":"2.0","method":"player.seek", "params": {"playerid": 0, "value": {"time":seekTime}}, "id": 0})
                        })
                        .then(response => {
                            if(apiHitCounter===removedIP.length+2*insertedIP.length-2) {
                                res.status(200).send({"message": "success"});
                            }
                            apiHitCounter++;
                        })
                    }
                }
                apiHitCounter++;
            })
        }

    })
    
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
