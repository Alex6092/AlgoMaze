function Gem(x, y)
{
    this.x = x;
    this.y = y;
    this.collected = false;
    this.image = Loader.getImage('gem');

    this.gridCollected = false;
}

Gem.prototype.getImage = function() {
    return this.image;
}

Gem.prototype.isCollected = function() {
    return this.collected;
}

Gem.prototype.collect = function() {
    this.collected = true;
}

Gem.prototype.reset = function() {
    this.collected = false;
    this.gridCollected = false;
}

function Switch(x, y, initialState)
{
    this.x = x;
    this.y = y;
    this.initialState = initialState;
    this.state = this.initialState;
    this.gridState = this.initialState;

    this.images = {}
    this.images[SwitchState.On] = Loader.getImage('switch_on');
    this.images[SwitchState.Off] = Loader.getImage('switch_off');
}

Switch.prototype.getImage = function() {
    return this.images[this.state];
}

Switch.prototype.reset = function() {
    this.state = this.initialState;
    this.gridState = this.initialState;
}

Switch.prototype.toggle = function() {
    if(this.state == SwitchState.On)
    {
        this.state = SwitchState.Off;
    }
    else
    {
        this.state = SwitchState.On;
    }
}

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
        3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3
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

    switches: [ { x: 128, y: 192, state: false }, { x: 256, y: 192, state: true} ],
    gems: [ { x: 128, y: 64 }],
    teleport1: [],
    teleport2: [],
    teleport3: [],
    teleport4: [],
    randomTile: [],
    startPosition: { x: 128, y: 128 },
    startDirection: Direction.Down,
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
            var isSolid = tile === 3 || tile === 5 || (tile === 0 && layer == 0);
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

function Hero(map) {
    this.startX = map.startPosition.x + map.tsize / 2;
    this.startY = map.startPosition.y + map.tsize / 2;
    this.startDirection = map.startDirection;
    this.map = map;
    this.x = this.startX;
    this.y = this.startY;
    this.xGrid = Math.floor(this.x / map.tsize);
    this.yGrid = Math.floor(this.y / map.tsize);
    this.width = map.tsize;
    this.height = map.tsize;

    this.images = {};
    this.images[Direction.Down] = Loader.getImage('hero_down');
    this.images[Direction.Up] = Loader.getImage('hero_up');
    this.images[Direction.Left] = Loader.getImage('hero_left');
    this.images[Direction.Right] = Loader.getImage('hero_right');

    this.direction = this.startDirection;
}

Hero.SPEED = 192; // pixels per second

Hero.prototype.getImage = function() {
    return this.images[this.direction];
}

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
    this.direction = Direction.Down;
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
    this.direction = Direction.Up;
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
    this.direction = Direction.Left;
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
    this.direction = Direction.Right;
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
    this.xGrid = Math.floor(this.startX / this.map.tsize);
    this.yGrid = Math.floor(this.startY / this.map.tsize);
    this.gridDirection = this.startDirection;
    this.direction = this.startDirection;
}

Hero.prototype.turnLeft = function()
{
    if(this.direction == Direction.Down)
    {
        this.direction = Direction.Right;
    }
    else if(this.direction == Direction.Right)
    {
        this.direction = Direction.Up;
    }
    else if(this.direction == Direction.Up)
    {
        this.direction = Direction.Left;
    }
    else if(this.direction == Direction.Left)
    {
        this.direction = Direction.Down;
    }
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
        Loader.loadImage('tiles', './assets/tiles.png'),

        Loader.loadImage('hero_down', './assets/down.png'),
        Loader.loadImage('hero_up', './assets/up.png'),
        Loader.loadImage('hero_left', './assets/left.png'),
        Loader.loadImage('hero_right', './assets/right.png'),

        Loader.loadImage('gem', './assets/gem.png'),

        Loader.loadImage('switch_off', './assets/switch_off.png'),
        Loader.loadImage('switch_on', './assets/switch_on.png'),

        Loader.loadImage('teleport_1', './assets/teleport-blue.png'),
        Loader.loadImage('teleport_2', './assets/teleport-red.png'),
        Loader.loadImage('teleport_3', './assets/teleport-green.png'),
        Loader.loadImage('teleport_4', './assets/teleport-purple.png'),

        Loader.loadImage('random', './assets/random.png')
    ];
};

Game.initializeGemsAndSwitches = function() {
    this.switches = [];
    for(var i = 0; i < map.switches.length; i++)
    {
        var _switch = map.switches[i];
        this.switches.push(new Switch(_switch.x, _switch.y, _switch.state ? SwitchState.On : SwitchState.Off));
    }

    this.gems = [];
    for(var i = 0; i < map.gems.length; i++)
    {
        var gem = map.gems[i];
        this.gems.push(new Gem(gem.x, gem.y));
    }

    for(var i = 0; i < map.randomTile.length; i++)
    {
        var tile = map.randomTile[i];
        var spawn = getRandomBinary();
        if(spawn)
        {
            var type = getRandomBinary();
            if(type)
            {
                // Spawn gemme
                this.gems.push(new Gem(tile.x, tile.y));
            }
            else
            {
                // Spawn interrupteur
                var open = getRandomBinary();
                this.switches.push(new Switch(tile.x, tile.y, open ? SwitchState.On : SwitchState.Off));
            }
        }
    }
};

Game.init = function () {
    //Keyboard.listenForEvents(
    //    [Keyboard.LEFT, Keyboard.RIGHT, Keyboard.UP, Keyboard.DOWN]);
    this.tileAtlas = Loader.getImage('tiles');

    this.actionQueue = new Array();
    this.hero = new Hero(map);
    this.initializeGemsAndSwitches();
    this.displayRandomTile = true;
};

Game.update = function (delta) {
    if(this.actionQueue.length > 0)
    {
        var actionName = this.actionQueue[0];

        if(actionName == "DOWN")
        {
            this.hero.goDown(delta, function() {
                checkTeleporter(false);
                Game.actionQueue.shift();
            });
        }
        else if(actionName == "UP")
        {
            this.hero.goUp(delta, function() {
                checkTeleporter(false);
                Game.actionQueue.shift();
            });
        }
        else if(actionName == "LEFT")
        {
            this.hero.goLeft(delta, function() {
                checkTeleporter(false);
                Game.actionQueue.shift();
            });
        }
        else if(actionName == "RIGHT")
        {
            this.hero.goRight(delta, function() {
                checkTeleporter(false);
                Game.actionQueue.shift();
            });
        }
        else if(actionName == "AVANCER")
        {
            var direction = this.hero.direction;
            this.actionQueue[0] = direction.toUpperCase();
        }
        else if(actionName == "TURN_LEFT")
        {
            this.hero.turnLeft();
            Game.actionQueue.shift();
        }
        else if(actionName == "TOGGLE_SWITCH")
        {
            var x = this.hero.x - map.tsize / 2;
            var y = this.hero.y - map.tsize / 2;

            for(var i = 0; i < this.switches.length; i++)
            {
                _switch = this.switches[i];
                if(_switch.x == x && _switch.y == y)
                {
                    _switch.toggle();
                }
            }

            Game.actionQueue.shift();
        }
        else if(actionName == "COLLECT_GEM")
        {
            var x = this.hero.x - map.tsize / 2;
            var y = this.hero.y - map.tsize / 2;

            for(var i = 0; i < this.gems.length; i++)
            {
                gem = this.gems[i];
                if(gem.x == x && gem.y == y)
                {
                    gem.collect();
                }
            }

            Game.actionQueue.shift();
        }
    }

    if(this.actionQueue.length == 0 && Game.displayRandomTile == false)
    {
        setTimeout(() => {
            if(this.actionQueue.length == 0 && Game.displayRandomTile == false) 
            {
                Game.displayRandomTile = true;
                Game.reset();
            }
        }, 1000);
    }
};

Game._drawLayer = function (layer) {
    for (var c = 0; c < map.cols; c++) {
        for (var r = 0; r < map.rows; r++) {
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

Game._drawGemsAndSwitches = function()
{
    for(var i = 0; i < this.switches.length; i++)
    {
        var _switch = this.switches[i];
        this.ctx.drawImage(_switch.getImage(), _switch.x, _switch.y);
    }

    for(var i = 0; i < this.gems.length; i++)
    {
        var gem = this.gems[i];
        if(!gem.isCollected())
        {
            this.ctx.drawImage(gem.getImage(), gem.x, gem.y);
        }
    }

    map.teleport1.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_1"), teleport.x, teleport.y);
    });
    map.teleport2.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_2"), teleport.x, teleport.y);
    });
    map.teleport3.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_3"), teleport.x, teleport.y);
    });
    map.teleport4.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_4"), teleport.x, teleport.y);
    });

    if(this.displayRandomTile)
    {
        map.randomTile.forEach(tile => {
            this.ctx.drawImage(Loader.getImage("random"), tile.x, tile.y);
        });
    }
}

Game.render = function () {
    // draw map background layer
    this._drawLayer(0);

    // draw gems and switches 
    this._drawGemsAndSwitches();

    // draw main character
    this.ctx.drawImage(
        this.hero.getImage(),
        this.hero.x - this.hero.width / 2,
        this.hero.y - this.hero.height / 2);

    
    // draw map top layer
    this._drawLayer(1);

    this._drawGrid();
};

Game.queueAction = function(actionName) {
    this.actionQueue.push(actionName);
};

Game.reset = function() {
    this.actionQueue = [];
    this.hero.resetPosition();
    /*
    for(var i = 0; i < this.switches.length; i++)
    {
        this.switches[i].reset();
    }

    for(var i = 0; i < this.gems.length; i++)
    {
        this.gems[i].reset();
    }
    */
    this.initializeGemsAndSwitches();
}

/*
function bas()
{
    Game.queueAction("DOWN");
}

function haut()
{
    Game.queueAction("UP");
}

function gauche()
{
    Game.queueAction("LEFT");
}

function droite()
{
    Game.queueAction("RIGHT");
}
*/

function isOnCellIn(x, y, cells)
{
    var result = false;
    for(var cell of cells)
    {
        if(cell.x == x && cell.y == y)
        {
            result = true;
            break;
        }
    }

    return result;
}

function getTeleportedToCell(xSrc, ySrc, cells)
{
    if(cells[0].x == xSrc && cells[0].y == ySrc)
    {
        return cells[1];
    }

    return cells[0];
}

function checkTeleporter(grid)
{
    var x = grid ? Game.hero.xGrid * map.tsize : Game.hero.x - map.tsize / 2;
    var y = grid ? Game.hero.yGrid * map.tsize : Game.hero.y - map.tsize / 2;

    var targetCell = null;
    if(isOnCellIn(x, y, map.teleport1))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport1);
    }
    if(isOnCellIn(x, y, map.teleport2))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport2);
    }
    if(isOnCellIn(x, y, map.teleport3))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport3);
    }
    if(isOnCellIn(x, y, map.teleport4))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport4);
    }


    if(targetCell != null)
    {
        if(grid)
        {
            Game.hero.xGrid = targetCell.x / map.tsize;
            Game.hero.yGrid = targetCell.y / map.tsize;
        }
        else
        {
            Game.hero.x = targetCell.x + map.tsize / 2;
            Game.hero.y = targetCell.y + map.tsize / 2;
        }
    }
}

function moveForward()
{
    Game.queueAction("AVANCER");

    var actionName = Game.hero.gridDirection;
    actionName = actionName.toUpperCase();

    if(actionName == "DOWN")
    {
        Game.hero.yGrid += 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.yGrid -= 1;
        }
    }
    else if(actionName == "UP")
    {
        Game.hero.yGrid -= 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.yGrid += 1;
        }
    }
    else if(actionName == "LEFT")
    {
        Game.hero.xGrid -= 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.xGrid += 1;
        }
    }
    else if(actionName == "RIGHT")
    {
        Game.hero.xGrid += 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.xGrid -= 1;
        }
    }

    checkTeleporter(true);
}

function turnLeft()
{
    Game.queueAction("TURN_LEFT");

    var direction = Game.hero.gridDirection;
    if(direction == Direction.Down)
    {
        direction = Direction.Right;
    }
    else if(direction == Direction.Right)
    {
        direction = Direction.Up;
    }
    else if(direction == Direction.Up)
    {
        direction = Direction.Left;
    }
    else if(direction == Direction.Left)
    {
        direction = Direction.Down;
    }

    Game.hero.gridDirection = direction;
}

function toggleSwitch()
{
    Game.queueAction("TOGGLE_SWITCH");
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            _switch.gridState = !_switch.gridState;
            break;
        }
    }
}

function collectGem()
{
    Game.queueAction("COLLECT_GEM");

    for(var gem of Game.gems) {
        if(gem.x / map.tsize == Game.hero.xGrid && gem.y / map.tsize == Game.hero.yGrid)
        {
            gem.gridCollected = true;
            break;
        }
    }
}

function canCollectGem()
{
    var result = false;
    for(var gem of Game.gems) {
        if(gem.x / map.tsize == Game.hero.xGrid && gem.y / map.tsize == Game.hero.yGrid && !gem.gridCollected)
        {
            result = true;
            break;
        }
    }
    return result;
}

function isOnSwitch()
{
    var result = false;
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            result = true;
            break;
        }
    }
    return result;
}

function canActivateSwitch()
{
    var result = false;
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            result = _switch.gridState == SwitchState.Off;
            break;
        }
    }
    return result;
}

function canDeactivateSwitch()
{
    var result = false;
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            result = _switch.gridState == SwitchState.On;
            break;
        }
    }
    return result;
}

function solve(code)
{
    Game.reset();
    Game.displayRandomTile = false;
    eval(code);
}

function getRandomBinary() {
    return Math.round(Math.random());
}

function initializeGame(data) {
    map.cols = data.cols;
    map.rows = data.rows;
    map.tsize = data.tsize;
    map.layers = data.layers;
    map.switches = data.switches;
    map.gems = data.gems;
    map.teleport1 = data.teleport1 == null ? [] : data.teleport1;
    map.teleport2 = data.teleport2 == null ? [] : data.teleport2;
    map.teleport3 = data.teleport3 == null ? [] : data.teleport3;
    map.teleport4 = data.teleport4 == null ? [] : data.teleport4;
    map.randomTile = data.randomTile == null ? [] : data.randomTile;
    map.startPosition = data.startPosition;
    map.startDirection = data.startDirection;

    // Afficher les consignes
    document.getElementById('instructions').innerHTML = data.instructions;

    Game.init();
}