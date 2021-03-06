/**
 * Created by JetBrains PhpStorm.
 * @author Tyutyunkov VE
 */

SIZES = {
    hint : 28
};

EinsteinController = function (size) {
    this.size = size || 6;
    this.root = $('einstein-panel');

    this.ehr = $('einstein-horizontal-rules');
    this.evr = $('einstein-vertical-rules');

    this.initField();
    this.initButtons();

    this.newGame();
};

Object.extend(EinsteinController.prototype, {
    initField : function () {
        this.vc = new ViewController(this.size);
    },

    initButtons : function () {
        $('new').onclick = (function (scope) {
            return function (event) {
                if (!scope.gc.isActive() || confirm('Вы действительно хотите начать новую игру?')) {
                    scope.newGame();
                    scope.vc.unhide();
                    scope.ehr.show();
                    scope.evr.show();
                    $('pause').update('Пауза');
                }
                return false;
            }
        })(this);

        $('pause').onclick = (function (scope) {
            return function (event) {
                if (!scope.gc.isActive()) {
                    return false;
                }
                if (scope.gc.isPaused()) {
                    scope.vc.unhide();
                    scope.ehr.show();
                    scope.evr.show();
                    scope.gc.resume();
                    $('pause').update('Пауза');
                } else {
                    scope.vc.hide();
                    scope.ehr.hide();
                    scope.evr.hide();
                    scope.gc.pause();
                    $('pause').update('Возобновить');
                }
                return false;
            }
        })(this);

        window.onblur = (function (scope) {
            return function (event) {
                if (!scope.gc.isActive() || scope.gc.isPaused()) {
                    return;
                }
                scope.vc.hide();
                scope.ehr.hide();
                scope.evr.hide();
                scope.gc.pause();
                $('pause').update('Возобновить');
                return;
            }
        })(this);

        $('test').onclick = (function (scope) {
            return function (event) {
                for (var i = 0; i < scope.rules.length; ++i) {
                    if ('open' == scope.rules[i].type()) {
                        scope.rules[i].apply(scope.gc);
                    }
                }
                return false;
            }
        })(this);
    },

    newGame : function () {
        this.data = new DataField(this.size);
        this.gc = new GameController(this.data);
        this.vc.setGameController(this.gc);
        this.vc.resetField();

        this.ehr.update();
        this.evr.update();

        var solver = new Solver(new GameController(this.data));
        while (!solver.isSolved()) {
            solver.addRule(this.createRule(solver.getRules()));
            solver.solve();
        }
        this.rules = solver.getRules();

        var solved;
        do {
            solved = false;
            for (var n = 0; n < this.rules.length; ++n) {
                solver = new Solver(new GameController(this.data));
                var trules = [].concat(this.rules);
                trules.splice(n, 1);
                solver.addRules(trules);
                solver.solve();
                if (solver.isSolved()) {
                    this.rules.splice(n, 1);
                    solved = true;
                    break;
                }
            }
        } while (solved);

        this.gc.start();

        var rstat = [];
        for (var i = 0; i < this.rules.length; ++i) {
            var rule = this.rules[i];
            var container;
            if ('open' === rule.type()) {
                rule.apply(this.gc);
            } else if ('under' === rule.type()) {
                container = Element.extend(document.createElement('div'));
                this.evr.insert(container);
                container.setStyle({'border' : '1px solid', 'float' : 'left', padding : '1px', margin : '5px'});
                container.oncontextmenu = (function (scope, element, index) {
                    rstat[index] = true;
                    return function (event) {
                        if (!scope.gc.isActive()) {
                            return false;
                        }
                        element.setStyle({opacity : (rstat[index] ? '0.15' : '1')});
                        rstat[index] = !rstat[index];
                        return false;
                    }
                })(this, container, i);
                rule.draw(container);
            } else if (['near', 'direction', 'between'].indexOf(rule.type()) > -1) {
                container = Element.extend(document.createElement('div'));
                this.ehr.insert(container);
                container.setStyle({'border' : '1px solid', 'float' : 'left', padding : '1px', margin : '5px'});
                container.oncontextmenu = (function (scope, element, index) {
                    rstat[index] = true;
                    return function (event) {
                        if (!scope.gc.isActive()) {
                            return false;
                        }
                        element.setStyle({opacity : (rstat[index] ? '0.15' : '1')});
                        rstat[index] = !rstat[index];
                        return false;
                    }
                })(this, container, i);
                rule.draw(container);
            }
        }
    },

    createRule : function (rules) {
        var found;
        var rule;
        do {
            found = false;
            rule = Rule.generate(this.data);
            for (var i = 0; i < rules.length; ++i) {
                if (rule.equals(rules[i])) {
                    found = true;
                    break;
                }
            }
        } while (found);

        return rule;
    }
});

DataField = function (size) {
    this.size = size;

    this.generate();
};

Object.extend(DataField.prototype, {
    generate : function () {
        this.data = [];
        for (var i = 0; i < this.size; ++i) {
            this.data[i] = [];

            var tmp = [];
            for (var j = 0; j < this.size; ++j) {
                tmp.push(j);
            }

            while (tmp.length > 0) {
                this.data[i].push(tmp.splice(Math.random() * tmp.length, 1)[0]);
            }
        }
    },

    getSize : function () {
        return this.size;
    },

    getValue : function (i, j) {
        return this.data[i][j];
    }
});

GameController = function (data) {
    this.data = data;
    this.size = this.data.getSize();

    this.init();
};

Object.extend(GameController.prototype, {
    init : function () {
        this.count = this.size * this.size;
        this.field = [];
        for (var i = 0; i < this.size; ++i) {
            this.field[i] = {
                cols   : [],
                values : []
            };
            for (var j = 0; j < this.size; ++j) {
                var cols, values;
                this.field[i].values[j] = {
                    possible : this.size,
                    cols     : cols = {}
                };
                this.field[i].cols[j] = {
                    possible : this.size,
                    values   : values = {},
                    defined  : null
                };
                for (var k = 0; k < this.size; ++k) {
                    cols[k] = true;
                    values[k] = true;
                }
            }
        }
    },

    getSize : function () {
        return this.size;
    },

    isPossible : function (i, j, k) {
        return (!this.isDefined(i, j) && this.field[i].cols[j].values[k]) || (this.isDefined(i, j) && this.getDefined(i, j) === k);
    },

    isDefined : function (i, j) {
        return this.field[i].cols[j].defined !== null;
    },

    getDefined : function (i, j) {
        return this.field[i].cols[j].defined;
    },

    set : function (i, j, k) {
        if (!this.isPossible(i, j, k) || this.isDefined(i, j)) {
            return;
        }

        if (this.data.getValue(i, j) != k) {
            this.stop();
            return;
        }

        --this.count;
        this.field[i].cols[j].possible = 0;
        this.field[i].values[k].possible = 0;
        this.field[i].cols[j].defined = k;
        for (var n = 0; n < this.size; ++n) {
            this.field[i].values[k].cols[n] = (n === j);
            this.field[i].values[n].possible -= (n !== k && this.field[i].cols[j].values[n] ? 1 : 0);
            this.field[i].values[n].cols[j] = (n === k);
        }
        for (var h = 0; h < this.size; ++h) {
            this.exclude(i, h, k);
        }

        if (this.onSet) {
            this.onSet(i, j, k);
        }

        this.checkSingle(i, j, k);

        if (0 === this.count) {
            this.stop();
        }
    },

    exclude : function (i, j, k) {
        if (!this.isPossible(i, j, k) || this.isDefined(i, j)) {
            return;
        }

        if (this.data.getValue(i, j) === k) {
            this.stop();
        }

        --this.field[i].cols[j].possible;
        this.field[i].cols[j].values[k] = false;
        --this.field[i].values[k].possible;
        this.field[i].values[k].cols[j] = false;
        if (this.onExclude) {
            this.onExclude(i, j, k);
        }

        this.checkSingle(i, j, k);
    },

    checkSingle : function (i, j, k) {
        if (this.field[i].cols[j].possible == 1) {
            for (var h = 0; h < this.size; ++h) {
                if (this.field[i].cols[j].values[h]) {
                    this.set(i, j, h);
                    break;
                }
            }
        }

        for (var t = 0; t < this.size; ++t) {
            if (this.field[i].values[t].possible == 1) {
                for (var n = 0; n < this.size; ++n) {
                    if (this.field[i].values[t].cols[n]) {
                        this.set(i, n, t);
                        break;
                    }
                }
            }
        }
    },

    setSetListener : function (listener) {
        this.onSet = listener;
    },

    setExcludeListener : function (listener) {
        this.onExclude = listener;
    },

    isActive : function () {
        return this.startGame && !this.endGame;
    },

    isPaused : function () {
        return !!this.startPause;
    },

    isSolved : function () {
        return this.count === 0;
    },

    isFail : function () {
        return !this.isActive() && !this.isSolved();
    },

    isVictory : function () {
        return !this.isActive() && this.isSolved();
    },

    start : function () {
        if (this.startGame) {
            return;
        }
        this.startGame = new Date().getTime();
    },

    pause : function () {
        if (this.startPause || !this.startGame) {
            return;
        }
        this.startPause = new Date().getTime();
    },

    resume : function () {
        if (!this.startPause || !this.startGame) {
            return;
        }
        this.startGame += (new Date().getTime() - this.startPause);
        this.startPause = undefined;
    },

    stop : function () {
        if (!this.startGame || this.endGame) {
            return;
        }
        this.endGame = this.endGame || new Date().getTime();
    },

    getTime : function () {
        return this.startGame ? Math.floor(((this.startPause || this.endGame || new Date().getTime()) - this.startGame) / 1000) : 0;
    }
});

ViewController = function (size) {
    // TODO: size!
    this.size = size;
    this.root = $('einstein-panel');
    this.info = $('info');

    this.buildField();
    this.interval = setInterval((function (scope) {
        return function () {
            scope.infoStat();
        }
    })(this), 1000);
};

Object.extend(ViewController.prototype, {
    buildField : function () {
        this.cells = [];
        this.hints = [];

        this.root.update();
        this.root.oncontextmenu = function (event) {
            return false;
        };
        for (var i = 0; i < this.size; ++i) {
            this.cells[i] = [];
            this.hints[i] = [];

            var tr = Element.extend(document.createElement('tr'));
            this.root.insert(tr);
            tr.setStyle({height : (3 * (SIZES.hint + 2 * 1) + 2 * 1) + 'px'});
            for (var j = 0; j < this.size; ++j) {
                this.hints[i][j] = {items : []};

                var td = Element.extend(document.createElement('td'));
                tr.insert(td);
                td.setStyle({width : (3 * (SIZES.hint + 2 * 1)) + 'px'});
                td.align = 'center';

                var img;
                img = this.cells[i][j] = Element.extend(document.createElement('img'));
                td.insert(img);

                img.setStyle({width : (3 * (SIZES.hint + 2 * 1)) + 'px', height : (3 * (SIZES.hint + 2 * 1)) + 'px'});
                img.hide();

                var itable = this.hints[i][j].view = Element.extend(document.createElement('table'));
                td.insert(itable);
                itable.setStyle({width : (3 * (SIZES.hint + 2 * 1)) + 'px'});
                itable.cellSpacing = 0;
                itable.cellPadding = 0;
                var itbody = Element.extend(document.createElement('tbody'));
                itable.insert(itbody);

                var itr, itd, iimg, k;
                itr = Element.extend(document.createElement('tr'));
                itbody.insert(itr);
                itr.setStyle({height : (SIZES.hint + 2 * 1) + 'px'});
                for (k = 0; k < 3; ++k) {
                    itd = Element.extend(document.createElement('td'));
                    itr.insert(itd);
                    itd.setStyle({width : (SIZES.hint) + 'px', cursor : 'pointer', border : '1px solid'});

                    iimg = this.hints[i][j].items[k] = Element.extend(document.createElement('img'));
                    itd.insert(iimg);

                    iimg.setStyle({width : (SIZES.hint) + 'px', height : (SIZES.hint) + 'px'});
                    iimg.src = 'images/item' + (i + 1) + (k + 1) + '.png';

                    itd.onmousedown = (function (scope, ii, ij, ik) {
                        return function (event) {
                            if (!scope.isActive()) {
                                return false;
                            }
                            scope.hintMouseDown(ii, ij, ik, event.button != 2);
                            scope.checkField();
                            return false;
                        }
                    })(this, i, j, k);
                }
                itr = Element.extend(document.createElement('tr'));
                itbody.insert(itr);
                itr.setStyle({height : (SIZES.hint + 2 * 1) + 'px'});
                for (k = 3; k < 6; ++k) {
                    itd = Element.extend(document.createElement('td'));
                    itr.insert(itd);
                    itd.setStyle({width : (SIZES.hint) + 'px', cursor : 'pointer', border : '1px solid'});

                    iimg = this.hints[i][j].items[k] = Element.extend(document.createElement('img'));
                    itd.insert(iimg);

                    iimg.setStyle({width : (SIZES.hint) + 'px', height : (SIZES.hint) + 'px'});
                    iimg.src = 'images/item' + (i + 1) + (k + 1) + '.png';

                    itd.onmousedown = (function (scope, ii, ij, ik) {
                        return function (event) {
                            if (!scope.isActive() || scope.game.isPaused()) {
                                return false;
                            }
                            scope.hintMouseDown(ii, ij, ik, event.button != 2);
                            scope.checkField();
                            return false;
                        }
                    })(this, i, j, k);
                }
                if (this.size > 6) {
                    itr = Element.extend(document.createElement('tr'));
                    itbody.insert(itr);
                    itr.setStyle({height : (SIZES.hint + 2 * 1) + 'px'});
                    for (k = 6; k < 9; ++k) {
                        itd = Element.extend(document.createElement('td'));
                        itr.insert(itd);
                        itd.setStyle({width : (SIZES.hint) + 'px', cursor : 'pointer', border : '1px solid'});

                        iimg = this.hints[i][j].items[k] = Element.extend(document.createElement('img'));
                        itd.insert(iimg);

                        iimg.setStyle({width : (SIZES.hint) + 'px', height : (SIZES.hint) + 'px'});
                        iimg.src = 'images/item' + (i + 1) + (k + 1) + '.png';

                        itd.onmousedown = (function (scope, ii, ij, ik) {
                            return function (event) {
                                if (!scope.isActive() || scope.game.isPaused()) {
                                    return false;
                                }
                                scope.hintMouseDown(ii, ij, ik, event.button != 2);
                                scope.checkField();
                                return false;
                            }
                        })(this, i, j, k);
                    }
                }
            }
        }
    },

    resetField : function () {
        var i, j, k;
        for (i = 0; i < this.size; ++i) {
            for (j = 0; j < this.size; ++j) {
                this.cells[i][j].hide();
                this.hints[i][j].view.show();

                for (k = 0; k < this.size; ++k) {
                    this.hints[i][j].items[k].show();
                    this.hints[i][j].items[k].up().setStyle({width : (SIZES.hint) + 'px'});
                    this.hints[i][j].items[k].up().setStyle({border : '1px solid black'});
                }
            }
        }
    },

    setGameController : function (gc) {
        this.game = gc;
        this.game.setSetListener((function (scope) {
            return function (i, j, k) {
                scope.onSet(i, j, k);
            }
        })(this));
        this.game.setExcludeListener((function (scope) {
            return function (i, j, k) {
                scope.onExclude(i, j, k);
            }
        })(this));
    },

    hintMouseDown : function (i, j, k, isSet) {
        if (isSet) {
            this.game.set(i, j, k);
        } else {
            this.game.exclude(i, j, k);
        }
    },

    onSet : function (i, j, k) {
        this.hints[i][j].view.hide();
        this.cells[i][j].src = 'images/item' + ((i + 1) % 10) + ((k + 1) % 10) + '.png';
        this.cells[i][j].show();
    },

    onExclude : function (i, j, k) {
        this.hints[i][j].items[k].up().setStyle({width : (SIZES.hint + 2 * 1) + 'px', border : '0'});
        this.hints[i][j].items[k].hide();
    },

    isActive : function () {
        return this.game && this.game.isActive();
    },

    checkField : function () {
        if (!this.isActive()) {
            if (this.game && this.game.isVictory()) {
                alert('victory');
                return;
            }
            if (this.game && this.game.isFail()) {
                alert('fail');
                return;
            }
            // TODO: unexpected status
        }
    },

    infoStat : function () {
        if (!this.game) {
            this.info.update('&nbsp;');
        } else {
            var time = this.game.getTime();
            var hours = Math.floor(time / 3600);
            var minutes = Math.floor((time % 3600) / 60);
            var seconds = Math.floor(time % 60);
            this.info.update('Время: <span style="font-weight: bold;">' + hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds +
                             '</span>');
        }
    },

    hide : function () {
        this.root.up().hide();//setStyle({opacity: 0});
    },

    unhide : function () {
        this.root.up().show();
    }
});

OpenRule = function (data) {
    this.generate(data);
};

Object.extend(OpenRule.prototype, {
    type     : function () {
        return 'open';
    },
    generate : function (data) {
        this.row = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.col = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.value = data.getValue(this.row, this.col);
    },
    apply    : function (game) {
        if (!game.isDefined(this.row, this.col)) {
            game.set(this.row, this.col, this.value);
            return true;
        } else {
            return false;
        }
    },
    equals   : function (rule) {
        if (rule.type() !== this.type()) {
            return false;
        }
        return (rule.row === this.row) && (rule.col === this.col);
    }
});

UnderRule = function (data) {
    this.generate(data);
};
Object.extend(UnderRule.prototype, {
    type     : function () {
        return 'under';
    },
    generate : function (data) {
        this.col = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.row1 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        do {
            this.row2 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        } while (this.row2 === this.row1);
        if (this.row1 > this.row2) {
            this.row1 += this.row2;
            this.row2 = this.row1 - this.row2;
            this.row1 = this.row1 - this.row2;
        }

        this.value1 = data.getValue(this.row1, this.col);
        this.value2 = data.getValue(this.row2, this.col);
    },
    apply    : function (game) {
        var changed = false;

        for (var i = 0; i < game.getSize(); ++i) {
            if ((!game.isPossible(this.row1, i, this.value1)) && game.isPossible(this.row2, i, this.value2)) {
                game.exclude(this.row2, i, this.value2);
                changed = true;
            }
            if ((!game.isPossible(this.row2, i, this.value2)) && game.isPossible(this.row1, i, this.value1)) {
                game.exclude(this.row1, i, this.value1);
                changed = true;
            }
        }

        return changed;
    },
    equals   : function (rule) {
        if (rule.type() !== this.type()) {
            return false;
        }
        return (rule.row1 === this.row1) && (rule.row2 === this.row2) && (rule.col === this.col);
    },
    draw     : function (box) {
        var table = Element.extend(document.createElement('table'));
        box.insert(table);
        table.cellSpacing = 0;
        table.cellPadding = 0;

        var tbody = Element.extend(document.createElement('tbody'));
        table.insert(tbody);
        var tr, td, img;

        tr = Element.extend(document.createElement('tr'));
        tbody.insert(tr);

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row1 + 1) % 10) + ((this.value1 + 1) % 10) + '.png';

        tr = Element.extend(document.createElement('tr'));
        tbody.insert(tr);

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row2 + 1) % 10) + ((this.value2 + 1) % 10) + '.png';
    }
});

NearRule = function (data) {
    this.generate(data);
};
Object.extend(NearRule.prototype, {
    type     : function () {
        return 'near';
    },
    generate : function (data) {
        this.row1 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.col1 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.row2 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.col2 = this.col1 === 0 ? 1 : (this.col1 === data.getSize() - 1 ? data.getSize() - 2 : this.col1 + (Math.random() < 0.5 ? -1 : +1));

        this.value1 = data.getValue(this.row1, this.col1);
        this.value2 = data.getValue(this.row2, this.col2);
    },
    apply    : function (game) {
        var changed = false;
        var iapply = function (game, j, i1, i2, v1, v2) {
            var left, right;
            left = j === 0 ? false : game.isPossible(i2, j - 1, v2);
            right = j === game.getSize() - 1 ? false : game.isPossible(i2, j + 1, v2);

            if (!left && !right && game.isPossible(i1, j, v1)) {
                game.exclude(i1, j, v1);
                return true;
            } else {
                return false;
            }
        };
        for (var i = 0; i < game.getSize(); ++i) {
            changed |= iapply(game, i, this.row1, this.row2, this.value1, this.value2);
            changed |= iapply(game, i, this.row2, this.row1, this.value2, this.value1);
        }
        return changed;
    },
    equals   : function (rule) {
        if (rule.type() !== this.type()) {
            return false;
        }
        return ((rule.row1 === this.row1) && (rule.col1 === this.col1) && (rule.row2 === this.row2) && (rule.col2 === this.col2)) ||
               ((rule.row2 === this.row1) && (rule.col2 === this.col1) && (rule.row1 === this.row2) && (rule.col1 === this.col2));
    },
    draw     : function (box) {
        var table = Element.extend(document.createElement('table'));
        box.insert(table);
        table.cellPadding = 0;
        table.cellSpacing = 0;

        var tbody = Element.extend(document.createElement('tbody'));
        table.insert(tbody);
        var tr, td, img;

        tr = Element.extend(document.createElement('tr'));
        tbody.insert(tr);

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row1 + 1) % 10) + ((this.value1 + 1) % 10) + '.png';

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/near.png';

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row2 + 1) % 10) + ((this.value2 + 1) % 10) + '.png';
    }
});

DirectionRule = function (data) {
    this.generate(data);
};
Object.extend(DirectionRule.prototype, {
    type     : function () {
        return 'direction';
    },
    generate : function (data) {
        this.row1 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.col1 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.row2 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        do {
            this.col2 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        } while (this.col2 === this.col1);
        if (this.col1 > this.col2) {
            this.col1 += this.col2;
            this.col2 = this.col1 - this.col2;
            this.col1 = this.col1 - this.col2;
        }

        this.value1 = data.getValue(this.row1, this.col1);
        this.value2 = data.getValue(this.row2, this.col2);
    },
    apply    : function (game) {
        var changed = false;

        var i;
        for (i = 0; i < game.getSize(); ++i) {
            if (game.isPossible(this.row2, i, this.value2)) {
                game.exclude(this.row2, i, this.value2);
                changed = true;
            }
            if (game.isPossible(this.row1, i, this.value1)) {
                break;
            }
        }
        for (i = game.getSize() - 1; i >= 0; --i) {
            if (game.isPossible(this.row1, i, this.value1)) {
                game.exclude(this.row1, i, this.value1);
                changed = true;
            }
            if (game.isPossible(this.row2, i, this.value2)) {
                break;
            }
        }

        return changed;
    },
    equals   : function (rule) {
        if (rule.type() !== this.type()) {
            return false;
        }
        return (rule.row1 === this.row1) && (rule.col1 === this.col1) && (rule.row2 === this.row2) && (rule.col2 === this.col2);
    },
    draw     : function (box) {
        var table = Element.extend(document.createElement('table'));
        box.insert(table);
        table.cellPadding = 0;
        table.cellSpacing = 0;

        var tbody = Element.extend(document.createElement('tbody'));
        table.insert(tbody);
        var tr, td, img;

        tr = Element.extend(document.createElement('tr'));
        tbody.insert(tr);

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row1 + 1) % 10) + ((this.value1 + 1) % 10) + '.png';

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/direction.png';

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row2 + 1) % 10) + ((this.value2 + 1) % 10) + '.png';
    }
});

BetweenRule = function (data) {
    this.generate(data);
};
Object.extend(BetweenRule.prototype, {
    type     : function () {
        return 'between';
    },
    generate : function (data) {
        this.row = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.row1 = Math.floor(Math.random() * data.getSize()) % data.getSize();
        this.row2 = Math.floor(Math.random() * data.getSize()) % data.getSize();

        this.col = 1 + Math.floor(Math.random() * (data.getSize() - 2)) % (data.getSize() - 2);

        var delta = Math.random() < 0.5 ? 1 : -1;

        this.value = data.getValue(this.row, this.col);
        this.value1 = data.getValue(this.row1, this.col - delta);
        this.value2 = data.getValue(this.row2, this.col + delta);
    },
    apply    : function (game) {
        var changed = false;

        if (game.isPossible(this.row, 0, this.value)) {
            game.exclude(this.row, 0, this.value);
            changed = true;
        }

        if (game.isPossible(this.row, game.getSize() - 1, this.value)) {
            game.exclude(this.row, game.getSize() - 1, this.value);
            changed = true;
        }

        var loop, i;
        do {
            loop = false;

            for (i = 1; i < game.getSize() - 1; ++i) {
                if (game.isPossible(this.row, i, this.value)) {
                    if (!((game.isPossible(this.row1, i - 1, this.value1) && game.isPossible(this.row2, i + 1, this.value2)) ||
                          (game.isPossible(this.row2, i - 1, this.value2) && game.isPossible(this.row1, i + 1, this.value1)))) {
                        game.exclude(this.row, i, this.value);
                        loop = true;
                    }
                }
            }

            for (i = 0; i < game.getSize(); ++i) {
                var left, right;

                if (game.isPossible(this.row2, i, this.value2)) {
                    left = i < 2 ? false : (game.isPossible(this.row, i - 1, this.value) && game.isPossible(this.row1, i - 2, this.value1));
                    right = i >= game.getSize() - 2 ? false : (game.isPossible(this.row, i + 1, this.value) && game.isPossible(this.row1, i + 2, this.value1));
                    if (!left && !right) {
                        game.exclude(this.row2, i, this.value2);
                        loop = true;
                    }
                }

                if (game.isPossible(this.row1, i, this.value1)) {
                    left = i < 2 ? false : (game.isPossible(this.row, i - 1, this.value) && game.isPossible(this.row2, i - 2, this.value2));
                    right = i >= game.getSize() - 2 ? false : (game.isPossible(this.row, i + 1, this.value) && game.isPossible(this.row2, i + 2, this.value2));
                    if (!left && !right) {
                        game.exclude(this.row1, i, this.value1);
                        loop = true;
                    }
                }
            }

            changed |= loop;
        } while (loop);

        return changed;
    },
    equals   : function (rule) {
        if (rule.type() !== this.type()) {
            return false;
        }
        return (rule.row === this.row) && (rule.col === this.col) &&
               (((rule.row1 === this.row1) && (rule.row2 === this.row2)) || ((rule.row1 === this.row2) && (rule.row2 === this.row1)));
    },
    draw     : function (box) {
        var table = Element.extend(document.createElement('table'));
        box.insert(table);
        table.cellPadding = 0;
        table.cellSpacing = 0;

        var tbody = Element.extend(document.createElement('tbody'));
        table.insert(tbody);
        var tr, td, img;

        tr = Element.extend(document.createElement('tr'));
        tbody.insert(tr);

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row1 + 1) % 10) + ((this.value1 + 1) % 10) + '.png';

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row + 1) % 10) + ((this.value + 1) % 10) + '.png';

        td = Element.extend(document.createElement('td'));
        tr.insert(td);
        td.align = 'center';

        img = Element.extend(document.createElement('img'));
        td.insert(img);

        img.setStyle({width : '48px', height : '48px'});
        img.src = 'images/item' + ((this.row2 + 1) % 10) + ((this.value2 + 1) % 10) + '.png';
    }
});

Rule = {
    generate : function (data) {
        switch (Math.floor(Math.random() * 14)) {
            case 0:
            case 1:
            case 2:
            case 3:
                return new NearRule(data);
            case 4:
                return new OpenRule(data);
            case 5:
            case 6:
                return new UnderRule(data);
            case 7:
            case 8:
            case 9:
            case 10:
                return new DirectionRule(data);
            case 11:
            case 12:
            case 13:
                return new BetweenRule(data);
            default:
                return Rule.generate(data);
        }
    }
};

Solver = function (game) {
    this.game = game;
    this.rules = [];
};

Object.extend(Solver.prototype, {
    addRule : function (rule) {
        this.rules.push(rule);
    },

    addRules : function (rules) {
        this.rules = this.rules.concat(rules);
    },

    getRules : function () {
        return this.rules;
    },

    solve : function () {
        var applied;
        do {
            applied = false;
            for (var i = 0; i < this.rules.length; ++i) {
                applied |= this.rules[i].apply(this.game);
            }
        } while (applied);

        return this.isSolved();
    },

    isSolved : function () {
        return this.game.isSolved();
    }
});