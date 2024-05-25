var map = {
    cols: 12,
    rows: 12,
    tsize: 64,
    layers: [[
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 3,
        3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 3,
        3, 3, 3, 1, 1, 2, 3, 3, 3, 3, 3, 3
    ], [
        4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 4, 4, 0, 5, 4, 4, 4, 4, 4, 4, 4,
        4, 4, 4, 0, 0, 3, 3, 3, 3, 3, 3, 3
    ]],
    getTile: function (layer, col, row) {
        return this.layers[layer][row * map.cols + col];
    },
    isSolidTileAtXY: function (x, y) {
        var col = Math.floor(x / this.tsize);
        var row = Math.floor(y / this.tsize);

        // tiles 3 and 5 are solid -- the rest are walkable
        // loop through all layers and return TRUE if any tile is solid
        return this.layers.reduce(function (res, layer, index) {
            var tile = this.getTile(index, col, row);
            var isSolid = tile === 3 || tile === 5;
            return res || isSolid;
        }.bind(this), false);
    },
    getCol: function (x) {
        return Math.floor(x / this.tsize);
    },
    getRow: function (y) {
        return Math.floor(y / this.tsize);
    },
    getX: function (col) {
        return col * this.tsize;
    },
    getY: function (row) {
        return row * this.tsize;
    }
};

function Hero(map, x, y) {
    this.startX = x;
    this.startY = y;
    this.map = map;
    this.x = x;
    this.y = y;
    this.width = map.tsize;
    this.height = map.tsize;

    this.image = Loader.getImage('hero');
}

Hero.SPEED = 256; // pixels per second

Hero.prototype.move = function (delta, dirx, diry) {
    // move hero
    this.x += dirx * Hero.SPEED * delta;
    this.y += diry * Hero.SPEED * delta;

    // check if we walked into a non-walkable tile
    this._collide(dirx, diry);

    // clamp values
    var maxX = this.map.cols * this.map.tsize;
    var maxY = this.map.rows * this.map.tsize;
    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
};

Hero.prototype.goDown = function(delta, onFinished)
{
    var curX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, 0, 1);

    var newX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    if(newY > curY)
    {
        this.y = newY * map.tsize + map.tsize / 2;
        onFinished();
    }
}

Hero.prototype.goUp = function(delta, onFinished)
{
    var curX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, 0, -1);

    var newX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    if (newY < curY)
    {
        this.y = newY * map.tsize + map.tsize / 2;
        onFinished();
    }
};

Hero.prototype.goLeft = function(delta, onFinished)
{
    var curX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, -1, 0);

    var newX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    if (newX < curX)
    {
        this.x = newX * map.tsize + map.tsize / 2;
        onFinished();
    }
};

Hero.prototype.goRight = function(delta, onFinished)
{
    var curX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, 1, 0);

    var newX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    if (newX > curX)
    {
        this.x = newX * map.tsize + map.tsize / 2;
        onFinished();
    }
};

Hero.prototype.resetPosition = function()
{
    this.x = this.startX;
    this.y = this.startY;
}

Hero.prototype._collide = function (dirx, diry) {
    var row, col;
    // -1 in right and bottom is because image ranges from 0..63
    // and not up to 64
    var left = this.x - this.width / 2;
    var right = this.x + this.width / 2 - 1;
    var top = this.y - this.height / 2;
    var bottom = this.y + this.height / 2 - 1;

    // check for collisions on sprite sides
    var collision =
        this.map.isSolidTileAtXY(left, top) ||
        this.map.isSolidTileAtXY(right, top) ||
        this.map.isSolidTileAtXY(right, bottom) ||
        this.map.isSolidTileAtXY(left, bottom);
    if (!collision) { return; }

    if (diry > 0) {
        row = this.map.getRow(bottom);
        this.y = -this.height / 2 + this.map.getY(row);
    }
    else if (diry < 0) {
        row = this.map.getRow(top);
        this.y = this.height / 2 + this.map.getY(row + 1);
    }
    else if (dirx > 0) {
        col = this.map.getCol(right);
        this.x = -this.width / 2 + this.map.getX(col);
    }
    else if (dirx < 0) {
        col = this.map.getCol(left);
        this.x = this.width / 2 + this.map.getX(col + 1);
    }
};

Game.load = function () {
    return [
        Loader.loadImage('tiles', '../assets/tiles.png'),
        Loader.loadImage('hero', '../assets/character.png')
    ];
};

Game.init = function () {
    Keyboard.listenForEvents(
        [Keyboard.LEFT, Keyboard.RIGHT, Keyboard.UP, Keyboard.DOWN]);
    this.tileAtlas = Loader.getImage('tiles');

    this.actionQueue = new Array();
    this.hero = new Hero(map, 160, 160);
};

Game.update = function (delta) {
    if(this.actionQueue.length > 0)
    {
        var actionName = this.actionQueue[0];

        if(actionName == "BAS")
        {
            this.hero.goDown(delta, function() {
                Game.actionQueue.shift();
            });
        }
        else if(actionName == "HAUT")
        {
            this.hero.goUp(delta, function() {
                Game.actionQueue.shift();
            });
        }
        else if(actionName == "GAUCHE")
        {
            this.hero.goLeft(delta, function() {
                Game.actionQueue.shift();
            });
        }
        else if(actionName == "DROITE")
        {
            this.hero.goRight(delta, function() {
                Game.actionQueue.shift();
            });
        }
    }
};

Game._drawLayer = function (layer) {
    for (var c = 0; c <= map.cols; c++) {
        for (var r = 0; r <= map.rows; r++) {
            var tile = map.getTile(layer, c, r);
            var x = c  * map.tsize;
            var y = r  * map.tsize;
            if (tile !== 0) { // 0 => empty tile
                this.ctx.drawImage(
                    this.tileAtlas, // image
                    (tile - 1) * map.tsize, // source x
                    0, // source y
                    map.tsize, // source width
                    map.tsize, // source height
                    Math.round(x),  // target x
                    Math.round(y), // target y
                    map.tsize, // target width
                    map.tsize // target height
                );
            }
        }
    }
};

Game._drawGrid = function () {
    var width = map.cols * map.tsize;
    var height = map.rows * map.tsize;
    var x, y;
    for (var r = 0; r < map.rows; r++) {
        x = 0;
        y = r * map.tsize;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(width, y);
        this.ctx.stroke();
    }
    for (var c = 0; c < map.cols; c++) {
        x = c * map.tsize;
        y = 0;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
    }
};

Game.render = function () {
    // draw map background layer
    this._drawLayer(0);

    // draw main character
    this.ctx.drawImage(
        this.hero.image,
        this.hero.x - this.hero.width / 2,
        this.hero.y - this.hero.height / 2);

    // draw map top layer
    this._drawLayer(1);

    this._drawGrid();
};

Game.queueAction = function(actionName) {
    this.actionQueue.push(actionName);
};


function bas()
{
    Game.queueAction("BAS");
}

function haut()
{
    Game.queueAction("HAUT");
}

function gauche()
{
    Game.queueAction("GAUCHE");
}

function droite()
{
    Game.queueAction("DROITE");
}

function solve(code)
{
    Game.hero.resetPosition();
    eval(code);
    
}