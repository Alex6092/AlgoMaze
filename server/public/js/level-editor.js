//const { Direction } = require("../shared");

function addSelectorItems() {
    const selectorContainer = document.getElementById('selector-container');

    function addToSelectorContainer(imgName, clickCallback)
    {
        const img = Loader.getImage(imgName);
        const div = document.createElement('div');
        div.className = 'selector-item';
        div.style.backgroundImage = `url(${img.src})`;
        div.addEventListener('click', clickCallback);
        selectorContainer.appendChild(div);
    }

    // Add tile images
    const tileImages = ['tiles', 'ground', 'tree_base', 'tree_high', 'bush'];
    tileImages.forEach((imgName, index) => {
        addToSelectorContainer(imgName, () => {
            currentTileType = index + 1;
        });
    });

    // Add gem image
    addToSelectorContainer('gem', () => {
        currentTileType = 'gem';
    });

    // Add switch images
    addToSelectorContainer('switch_off', () => {
        currentTileType = 'switch_off';
    });

    addToSelectorContainer('switch_on', () => {
        currentTileType = 'switch_on';
    });

    addToSelectorContainer('random', () => {
        currentTileType = 'random';
    });

    // Add teleporter images 
    const teleporterImages = ['teleport_1', 'teleport_2', 'teleport_3', 'teleport_4'];
    teleporterImages.forEach((imgName, index) => {
        addToSelectorContainer(imgName, () => {
            currentTileType = `teleport_${imgName.split('_')[1]}`;
        });
    });

    // Add hero start positions
    const heroImages = ['hero_down', 'hero_up', 'hero_left', 'hero_right'];
    heroImages.forEach((imgName, index) => {
        addToSelectorContainer(imgName, () => {
            currentTileType = `hero_${imgName.split('_')[1]}`;
        });
    });

    addToSelectorContainer('trash', () => {
        currentTileType = 'trash';
    });
}

var map = {
    cols: 12,
    rows: 12,
    tsize: 64,
    layers: [
        [
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
        ],
        [
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
        ]
    ],

    switches: [],
    gems: [],
    teleport1: [],
    teleport2: [],
    teleport3: [],
    teleport4: [],
    randomTile: [],
    startPosition: { x: 128, y: 128 },
    startDirection: Direction.Down,
    removeObjectAt: function (x, y){
        x *= this.tsize;
        y *= this.tsize;

        for(var i = 0; i < this.gems.length; i++)
        {
            var gem = this.gems[i];
            if(gem.x == x && gem.y == y)
            {
                this.gems.splice(i, 1);
                break;
            }
        }

        for(var i = 0; i < this.switches.length; i++)
        {
            var _switch = this.switches[i];
            if(_switch.x == x && _switch.y == y)
            {
                this.switches.splice(i, 1);
                break;
            }
        }

        for(var i = 0; i < this.teleport1.length; i++)
        {
            var teleport = this.teleport1[i];
            if(teleport.x == x && teleport.y == y)
            {
                this.teleport1.splice(i, 1);
                break;
            }
        }

        for(var i = 0; i < this.teleport2.length; i++)
        {
            var teleport = this.teleport2[i];
            if(teleport.x == x && teleport.y == y)
            {
                this.teleport2.splice(i, 1);
                break;
            }
        }

        for(var i = 0; i < this.teleport3.length; i++)
        {
            var teleport = this.teleport3[i];
            if(teleport.x == x && teleport.y == y)
            {
                this.teleport3.splice(i, 1);
                break;
            }
        }

        for(var i = 0; i < this.teleport4.length; i++)
        {
            var teleport = this.teleport4[i];
            if(teleport.x == x && teleport.y == y)
            {
                this.teleport4.splice(i, 1);
                break;
            }
        }

        for(var i = 0; i < this.randomTile.length; i++)
        {
            var tile = this.randomTile[i];
            if(tile.x == x && tile.y == y)
            {
                this.randomTile.splice(i, 1);
                break;
            }
        }
    },
    setTile: function (col, row, value) {
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            if(value == 'trash') {
                this.removeObjectAt(col, row);
                this.layers[0][(row) * map.cols + col] = 0;
                this.layers[1][(row) * map.cols + col] = 0;
            }
            else if (value == 'gem') {
                this.removeObjectAt(col, row);
                this.gems.push({ x: col * this.tsize, y: row * this.tsize });
            } else if (value == 'switch_off') {
                this.removeObjectAt(col, row);
                this.switches.push({ x: col * this.tsize, y: row * this.tsize, state: false });
            } else if (value == 'switch_on') {
                this.removeObjectAt(col, row);
                this.switches.push({ x: col * this.tsize, y: row * this.tsize, state: true });
            } 
            else if (value == 'teleport_1')
            {
                this.removeObjectAt(col, row);
                this.teleport1.push({ x: col * this.tsize, y: row * this.tsize });

                if(this.teleport1.length > 2)
                {
                    this.teleport1.shift();
                }
            }
            else if (value == 'teleport_2')
            {
                this.removeObjectAt(col, row);
                this.teleport2.push({ x: col * this.tsize, y: row * this.tsize });

                if(this.teleport2.length > 2)
                {
                    this.teleport2.shift();
                }
            }
            else if (value == 'teleport_3')
            {
                this.removeObjectAt(col, row);
                this.teleport3.push({ x: col * this.tsize, y: row * this.tsize });

                if(this.teleport3.length > 2)
                {
                    this.teleport3.shift();
                }
            }
            else if (value == 'teleport_4')
            {
                this.removeObjectAt(col, row);
                this.teleport4.push({ x: col * this.tsize, y: row * this.tsize });

                if(this.teleport4.length > 2)
                {
                    this.teleport4.shift();
                }
            }
            else if (value == 'random')
            {
                this.removeObjectAt(col, row);
                this.randomTile.push({ x: col * this.tsize, y: row * this.tsize });
            }
            else if ((typeof value === 'string' || value instanceof String) && value.includes('hero')) {
                const dir = value.split('_')[1];
                var direction = Direction.Down;
                if(dir == "down")
                    direction = Direction.Down;
                else if(dir == "up")
                    direction = Direction.Up;
                else if(dir == "left")
                    direction = Direction.Left;
                else if(dir == "right")
                    direction = Direction.Right;

                this.startPosition = { x: col * this.tsize, y: row * this.tsize };
                this.startDirection = direction;
            } else {
                this.layers[value != 4 && value != 5 ? 0 : 1][row * map.cols + col] = value;
                if (value == 3 && row > 0) {
                    this.layers[1][(row - 1) * map.cols + col] = 4;
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

        Loader.loadImage('random', './assets/random.png'),

        Loader.loadImage('ground', './assets/ground.png'),
        Loader.loadImage('tree_base', './assets/tree_base.png'),
        Loader.loadImage('tree_high', './assets/tree_high.png'),
        Loader.loadImage('bush', './assets/bush.png'),

        Loader.loadImage('trash', './assets/trash.png')
    ];
};

Game.firstInit = true;

Game.init = function () {
    this.tileAtlas = Loader.getImage('tiles');
    this.heroImg = [];
    this.heroImg[Direction.Down] = Loader.getImage('hero_down');
    this.heroImg[Direction.Up] = Loader.getImage('hero_up');
    this.heroImg[Direction.Left] = Loader.getImage('hero_left');
    this.heroImg[Direction.Right] = Loader.getImage('hero_right');

    if(this.firstInit)
    {
        addSelectorItems();
        this.firstInit = false;
    }
};

Game.update = function (delta) {};

Game._drawLayer = function (layer) {
    for (var c = 0; c < map.cols; c++) {
        for (var r = 0; r < map.rows; r++) {
            var tile = map.getTile(layer, c, r);
            var x = c * map.tsize;
            var y = r * map.tsize;
            if (tile > 0) {
                this.ctx.drawImage(
                    this.tileAtlas,
                    (tile - 1) * map.tsize,
                    0,
                    map.tsize,
                    map.tsize,
                    Math.round(x),
                    Math.round(y),
                    map.tsize,
                    map.tsize
                );
            }
        }
    }
};

Game._drawGrid = function () {
    var width = map.cols * map.tsize;
    var height = map.rows * map.tsize;
    for (var r = 0; r < map.rows; r++) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, r * map.tsize);
        this.ctx.lineTo(width, r * map.tsize);
        this.ctx.stroke();
    }
    for (var c = 0; c < map.cols; c++) {
        this.ctx.beginPath();
        this.ctx.moveTo(c * map.tsize, 0);
        this.ctx.lineTo(c * map.tsize, height);
        this.ctx.stroke();
    }
};

Game._drawGemsAndSwitches = function () {
    map.switches.forEach(_switch => {
        this.ctx.drawImage(_switch.state ? Loader.getImage("switch_on") : Loader.getImage("switch_off"), _switch.x, _switch.y);
    });
    map.gems.forEach(gem => {
        this.ctx.drawImage(Loader.getImage("gem"), gem.x, gem.y);
    });
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
    map.randomTile.forEach(tile => {
        this.ctx.drawImage(Loader.getImage("random"), tile.x, tile.y);
    });
}

Game.render = function () {
    this._drawLayer(0);
    this._drawGemsAndSwitches();
    this.ctx.drawImage(
        this.heroImg[map.startDirection],
        map.startPosition.x,
        map.startPosition.y
    );
    this._drawLayer(1);
    this._drawGrid();
};

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

    Game.init();
}
