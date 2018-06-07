const express = require('express')
const app = express()
const serv = require('http').Server(app)
const io = require('socket.io')(serv, {})

// serve
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/client/index.html')
})
app.use('/client', express.static(__dirname + '/client'))

serv.listen(2000, () => {
  console.log('App listening on port 2000!')
})

// game
let SOCKET_LIST = {}

// NOTE: OOP implemented in ES5 - no ES6 Classes.

const Entity = function(id) {
  var self = {
    x: 250,
    y: 250,
    spdX: 0,
    spdY: 0,
    id: ""
  }
  self.update = function() {
    self.updatePosition()
  }
  self.updatePosition = function() {
    self.x += self.spdX
    self.y += self.spdY
  }
  return self
}

const Player = function(id) {
  var self = Entity()
  self.id = id
  self.number = "" + Math.floor(10 * Math.random())
  self.pressingRight = false
  self.pressingLeft = false
  self.pressingUp = false
  self.pressingDown = false
  self.maxSpd = 10

  // interesting way of doing super()...
  const super_update = self.update
  self.update = function() {
    self.updateSpd()
    super_update()
  }

  self.updateSpd = function() {
    if(self.pressingRight)
        self.spdX = self.maxSpd
    else if(self.pressingLeft)
        self.spdX = -self.maxSpd
    else
        self.spdX = 0

    if(self.pressingUp)
        self.spdY = -self.maxSpd
    else if(self.pressingDown)
        self.spdY = self.maxSpd
    else
        self.spdY = 0
  }
  Player.list[id] = self
  return self
}

Player.list = {}

Player.onConnect = function(socket) {
  const player = Player(socket.id)
  socket.on('keyPress', (data) => {
    if(data.inputId === 'left')
        player.pressingLeft = data.state
    else if(data.inputId === 'right')
        player.pressingRight = data.state
    else if(data.inputId === 'up')
        player.pressingUp = data.state
    else if(data.inputId === 'down')
        player.pressingDown = data.state
  })
}

Player.onDisconnect = function(socket) {
  delete Player.list[socket.id]
}

Player.update = function() {
  let pack = []
  for (let i in Player.list) {
    const player = Player.list[i]
    player.update()
    pack.push({
      x: player.x,
      y: player.y,
      number: player.number
    })
  }
  return pack
}

const Bullet = function(angle) {
  const self = Entity()
  self.id = Math.random()
  self.spdX = Math.cos(angle/180*Math.PI) * 10
  self.spdY = Math.sin(angle/180*Math.PI) * 10
  self.timer = 0
  self.toRemove = false
  const super_update = self.update
  self.update = function() {
    if (self.timer++ > 100)
        self.toRemove = true
    super_update()
  }
  Bullet.list[self.id] = self
  return self
}

Bullet.list = {}

Bullet.update = function() {
  if (Math.random() < 0.1) {
    Bullet(Math.random() * 360)
  }
  let pack = []
  for (let i in Bullet.list) {
    const bullet = Bullet.list[i]
    bullet.update()
    pack.push({
      x: bullet.x,
      y: bullet.y
    })
  }
  return pack
}

// I just added this after bullet.update(); and before pack.push(...); if (bullet.toRemove == true) delete Bullet.list[i];﻿

// web socket
io.on('connection', (socket) => {
  socket.id = Math.random()
  SOCKET_LIST[socket.id] = socket

  Player.onConnect(socket)

  socket.on('disconnect', () => {
    delete SOCKET_LIST[socket.id]
    Player.onDisconnect(socket)
  })

  socket.on('sendMsgToServer', (data) => {
    const playerName = ("" + socket.id).slice(2, 7)
    for (let i in SOCKET_LIST) {
      SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data)
    }
  })
})

// game loop
setInterval(function() {
  const pack = {
    player: Player.update(),
    bullet: Bullet.update()
  }
  for(let i in SOCKET_LIST) {
    const socket = SOCKET_LIST[i]
    socket.emit('newPosition', pack)
  }
}, 1000/25)
