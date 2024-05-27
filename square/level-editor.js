//const { Direction } = require("../shared");

function addSelectorItems() {
    const selectorContainer = document.getElementById('selector-container');

    // Add tile images
    const tileImages = ['tiles', 'ground', 'tree_base', 'tree_high', 'bush'];
    tileImages.forEach((imgName, index) => {
        const img = Loader.getImage(imgName);
        const div = document.createElement('div');
        div.className = 'selector-item';
        div.style.backgroundImage = `url(${img.src})`;
        div.addEventListener('click', () => {
            currentTileType = index + 1;
        });
        selectorContainer.appendChild(div);
    });

    // Add gem image
    const gemImg = Loader.getImage('gem');
    const gemDiv = document.createElement('div');
    gemDiv.className = 'selector-item';
    gemDiv.style.backgroundImage = `url(${gemImg.src})`;
    gemDiv.addEventListener('click', () => {
        currentTileType = 'gem';
    });
    selectorContainer.appendChild(gemDiv);

    // Add switch images
    const switchOffImg = Loader.getImage('switch_off');
    const switchOffDiv = document.createElement('div');
    switchOffDiv.className = 'selector-item';
    switchOffDiv.style.backgroundImage = `url(${switchOffImg.src})`;
    switchOffDiv.addEventListener('click', () => {
        currentTileType = 'switch_off';
    });
    selectorContainer.appendChild(switchOffDiv);

    const switchOnImg = Loader.getImage('switch_on');
    const switchOnDiv = document.createElement('div');
    switchOnDiv.className = 'selector-item';
    switchOnDiv.style.backgroundImage = `url(${switchOnImg.src})`;
    switchOnDiv.addEventListener('click', () => {
        currentTileType = 'switch_on';
    });
    selectorContainer.appendChild(switchOnDiv);

    // Add hero start positions
    const heroImages = ['hero_down', 'hero_up', 'hero_left', 'hero_right'];
    heroImages.forEach((imgName, index) => {
        const img = Loader.getImage(imgName);
        const div = document.createElement('div');
        div.className = 'selector-item';
        div.style.backgroundImage = `url(${img.src})`;
        div.addEventListener('click', () => {
            currentTileType = `hero_${imgName.split('_')[1]}`;
        });
        selectorContainer.appendChild(div);
    });

    const trashImg = Loader.getImage('trash');
    const trashDiv = document.createElement('div');
    trashDiv.className = 'selector-item';
    trashDiv.style.backgroundImage = `url(${trashImg.src})`;
    trashDiv.addEventListener('click', () => {
        currentTileType = 'trash';
    });
    selectorContainer.appendChild(trashDiv);
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
            } else if ((typeof value === 'string' || value instanceof String) && value.includes('hero')) {
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
        Loader.loadImage('tiles', '../assets/tiles.png'),
        Loader.loadImage('hero_down', '../assets/down.png'),
        Loader.loadImage('hero_up', '../assets/up.png'),
        Loader.loadImage('hero_left', '../assets/left.png'),
        Loader.loadImage('hero_right', '../assets/right.png'),
        Loader.loadImage('gem', '../assets/gem.png'),
        Loader.loadImage('switch_off', '../assets/switch_off.png'),
        Loader.loadImage('switch_on', '../assets/switch_on.png'),

        Loader.loadImage('ground', '../assets/ground.png'),
        Loader.loadImage('tree_base', '../assets/tree_base.png'),
        Loader.loadImage('tree_high', '../assets/tree_high.png'),
        Loader.loadImage('bush', '../assets/bush.png'),

        Loader.loadImage('trash', '../assets/trash.png')
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
    map.startPosition = data.startPosition;
    map.startDirection = data.startDirection;

    Game.init();
}
