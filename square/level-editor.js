
function Gem(x, y)
{
    this.x = x;
    this.y = y;
    this.collected = false;
    this.image = Loader.getImage('gem');
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
}

function Switch(x, y, initialState)
{
    this.x = x;
    this.y = y;
    this.initialState = initialState;
    this.state = this.initialState;

    this.images = {}
    this.images[SwitchState.On] = Loader.getImage('switch_on');
    this.images[SwitchState.Off] = Loader.getImage('switch_off');
}

Switch.prototype.getImage = function() {
    return this.images[this.state];
}

Switch.prototype.reset = function() {
    this.state = this.initialState;
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
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ], [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]],

    switches: [],
    gems: [],
    startPosition: { x: 128, y: 128},
    startDirection: Direction.Down,
    setTile: function (col, row, value) {
        if(col >= 0 && col < this.cols && row >= 0 && row < this.rows)
        {
            if(value == "gem")
            {

            }
            else if(value == "switch")
            {

            }
            else if(value == "spawn")
            {

            }
            else
            {
                this.layers[0][row * map.cols + col] = value;
                // Automatically fill layer 1 with top of tree :
                if(value == 3)
                {
                    if(row > 0)
                        this.layers[1][(row - 1) * map.cols + col] = value;
                }
            }
        }
    },
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

function Hero(map) {
    this.startX = map.startPosition.x + map.tsize / 2;
    this.startY = map.startPosition.y + map.tsize / 2;
    this.startDirection = map.startDirection;
    this.map = map;
    this.x = this.startX;
    this.y = this.startY;
    this.width = map.tsize;
    this.height = map.tsize;

    this.images = {};
    this.images[Direction.Down] = Loader.getImage('hero_down');
    this.images[Direction.Up] = Loader.getImage('hero_up');
    this.images[Direction.Left] = Loader.getImage('hero_left');
    this.images[Direction.Right] = Loader.getImage('hero_right');

    this.direction = this.startDirection;
}

Hero.prototype.getImage = function() {
    return this.images[this.direction];
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

Game.load = function () {
    return [
        Loader.loadImage('tiles', '../assets/tiles.png'),

        Loader.loadImage('hero_down', '../assets/down.png'),
        Loader.loadImage('hero_up', '../assets/up.png'),
        Loader.loadImage('hero_left', '../assets/left.png'),
        Loader.loadImage('hero_right', '../assets/right.png'),

        Loader.loadImage('gem', '../assets/gem.png'),

        Loader.loadImage('switch_off', '../assets/switch_off.png'),
        Loader.loadImage('switch_on', '../assets/switch_on.png')
    ];
};

Game.init = function () {
    //Keyboard.listenForEvents(
    //    [Keyboard.LEFT, Keyboard.RIGHT, Keyboard.UP, Keyboard.DOWN]);
    this.tileAtlas = Loader.getImage('tiles');

    this.actionQueue = new Array();
    this.hero = new Hero(map);
    this.switches = [];
    for(var i = 0; i < map.switches.length; i++)
    {
        _switch = map.switches[i];
        this.switches.push(new Switch(_switch.x, _switch.y, _switch.state ? SwitchState.On : SwitchState.Off));
    }

    this.gems = [];
    for(var i = 0; i < map.gems.length; i++)
    {
        gem = map.gems[i];
        this.gems.push(new Gem(gem.x, gem.y));
    }
};

Game.update = function (delta) {
    
};

Game._drawLayer = function (layer) {
    for (var c = 0; c < map.cols; c++) {
        for (var r = 0; r < map.rows; r++) {
            var tile = map.getTile(layer, c, r);
            var x = c  * map.tsize;
            var y = r  * map.tsize;
            if (tile > 0) { // 0 => empty tile
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






// Load level from API :
/*
async function loadLevel(levelId) {
    try {
        let response = await fetch(`http://127.0.0.1:3000/level/${levelId}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        let data = await response.json();
        initializeGame(data);
    } catch (error) {
        console.error('Error loading level:', error);
        alert('Error loading level: ' + error.message);
    }
}
*/
function initializeGame(data) {
    map.cols = data.cols;
    map.rows = data.rows;
    map.tsize = data.tsize;
    map.layers = data.layers;
    map.switches = data.switches;
    map.gems = data.gems;
    map.startPosition = data.startPosition;
    map.startDirection = data.startDirection;

    // Afficher les consignes
    //document.getElementById('instructions').innerHTML = data.instructions;

    Game.init();
}
