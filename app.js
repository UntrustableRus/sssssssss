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

var Entity = function(id) {
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

var Player = function(id) {
  var self = Entity()
  self.id = id
  self.number = "" + Math.floor(10 * Math.random())
  self.pressingRight = false
  self.pressingLeft = false
  self.pressingUp = false
  self.pressingDown = false
  self.maxSpd = 10

  var super_update = self.update

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
  var player = Player(socket.id)
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

io.on('connection', (socket) => {
  socket.id = Math.random()
  SOCKET_LIST[socket.id] = socket

  Player.onConnect(socket)

  socket.on('disconnect', (socket) => {
    delete SOCKET_LIST[socket.id]
    Player.onDisconnect(socket)
  })
})

// game loop
setInterval(function() {
  var pack = Player.update()
  for(let i in SOCKET_LIST) {
    const socket = SOCKET_LIST[i]
    socket.emit('newPosition', pack)
  }
}, 1000/25)
