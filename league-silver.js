function getDistance(x1, y1, x2, y2) {
    const a = x2 - x1;
    const b = y2 - y1;
    return (Math.sqrt(a * a + b * b));
}

function getRandomValue(min, max) {
    return (Math.floor(Math.random() * (max - min) + min));
}

class Coords {
    constructor(x, y) {
        this.x = (typeof x == 'number' ? Math.floor(x) : parseInt(x));
        this.y = (typeof y == 'number' ? Math.floor(y) : parseInt(y));
    }

    static convertToLogical(x, y) {
        const newX = x - 8815;
        const newY = -(y - 4500);
        return [newX, newY];
    }

    static convertToGamical(x, y) {
        const newX = x + 8815;
        const newY = -(y + 4500);
        return [newX, newY];
    }
}

class LogicalCoords extends Coords {
    constructor(x, y) {
        super(x, y);
    }

    clone() {
        return (new LogicalCoords(this.x, this.y));
    }

    toGamical() {
        const convPos = Coords.convertToGamical(this.x, this.y);
        return (new GamicalCoords(convPos[0], convPos[1]));
    }
}

class GamicalCoords extends Coords {
    constructor(x, y) {
        super(x, y);
    }

    clone() {
        return (new GamicalCoords(this.x, this.y));
    }

    toLogical() {
        const convPos = Coords.convertToLogical(this.x, this.y);
        return (new LogicalCoords(convPos[0], convPos[1]));
    }
}

class Position {
    update(x, y) {
        // x and y are gamical coordinates
        this.g = new GamicalCoords(x, y);
        this.l = this.g.toLogical();
    }

    constructor(x, y) {
        this.update(x, y);
    }

    clonePosition() {
        return (new Position(this.g.x, this.g.y));
    }

    getDistanceTo(position) {
        return (getDistance(this.g.x, this.g.y, position.g.x, position.g.y));
    }
}

class Entity extends Position {
    update(inputs) {
        super.update(inputs[2], inputs[3]);

        this.id = parseInt(inputs[0]); // Unique identifier
        // this.type = parseInt(inputs[1]); // 0=monster, 1=your hero, 2=opponent hero
        this.shieldLife = parseInt(inputs[4]); // Count down until shield spell fades
        this.isControlled = parseInt(inputs[5]); // Equals 1 when this entity is under a control spell
    }

    constructor(inputs) {
        super(inputs[2], inputs[3]);

        this.update(inputs);
    }

    static getById(entities, id) {
        if (id == -1)
            return (null);
        for (const entity of entities) {
            if (entity.id == id) {
                return (entity);
            }
        }
        return (null);
    }

    isNearBaseCamp(base) {
        const dist = getDistance(base.g.x, base.g.y, this.g.x, this.g.y);
        return (dist > 5000 && dist < 9000);
    }

    isInBaseCamp(base) {
        const dist = getDistance(base.g.x, base.g.y, this.g.x, this.g.y);
        return (dist <= 5000);
    }

    isCriticallyInBaseCamp(base) {
        const dist = getDistance(base.g.x, base.y, this.g.x, this.g.y);
        return (dist <= 2000);
    }
}

class Hero extends Entity {
    constructor(defendBase, attackBase, inputs, heroNum, patrolRange, poiX, poiY) {
        super(inputs);

        this.focusEntityId = -1;
        this.heroNum = heroNum;
        this.defendBase = defendBase;
        this.attackBase = attackBase;
        this.patrolRange = patrolRange;
        this.origFocus = defendBase.getPositionBasedOn(poiX, poiY);
        this.focusPoint = this.origFocus.clonePosition();
    }

    static moveTo(position, text) {
        console.log('MOVE ' + position.g.x + ' ' + position.g.y + (text ? ' ' + text : ''));
    }

    static wait(text) {
        console.log('WAIT');
    }

    static wind(direction, text) {
        console.log('SPELL WIND ' + direction.g.x + ' ' + direction.g.y + (text ? ' ' + text : ''));
    }

    static shield(entityId, text) {
        console.log('SPELL SHIELD ' + entityId + (text ? ' ' + text : ''));
    }

    static control(entityId, direction, text) {
        console.log('SPELL CONTROL ' + entityId + ' ' + direction.g.x + ' ' + direction.g.y + (text ? ' ' + text : ''));
    }

    setFocusPoint(position) {
        this.focusPoint = position;
    }

    moveToFocusPoint(text) {
        Hero.moveTo(this.focusPoint, text);
    }

    patrol() {
        const newFocusPoint = new Position(this.origFocus.g.x + getRandomValue(-this.patrolRange, this.patrolRange), this.origFocus.g.y + getRandomValue(-this.patrolRange, this.patrolRange));
        this.setFocusPoint(newFocusPoint);
        this.moveToFocusPoint();
    }

    setFocusOnEntity(entity) {
        this.focusEntityId = entity.id;
        if (!(entity instanceof Monster)) {
            this.setFocusPoint(entity);
            return;
        }
        const bestIntercept = entity.getBestInterceptPosition(this);
        this.setFocusPoint(bestIntercept);
    }

    clearFocusOnEntity() {
        this.focusEntityId = -1;
    }

    get hasFocusEntity() {
        return (this.focusEntityId > -1);
    }

    static isAlreadyFocusedByOtherHero(heroes, entityId) {
        for (const hero of heroes) {
            if (hero.focusEntityId == entityId) {
                return (true);
            }
        }
        return (false);
    }

    get isAtFocusPoint() {
        return (this.getDistanceTo(this.focusPoint) == 0);
    }

    get hasNonDefaultFocusPoint() {
        return (this.focusPoint.g.x != this.origFocus.g.x || this.focusPoint.y != this.origFocus.y);
    }
}

class Defender extends Hero {
    constructor(defendBase, attackBase, inputs, heroNum) {
        super(defendBase, attackBase, inputs, heroNum, 2500, 1000, 1000);
    }

    findTarget(targets) {
        const targetsNum = targets.length;
        const dists = new Array(targetsNum);
        dists.fill(Infinity);
        for (let i = 0; i < targetsNum; i++) {
            if (targets[i] instanceof Monster && targets[i].threatFor == 1)
                dists[i] = this.getDistanceTo(targets[i]);
        }
        const smallestDist = Math.min.apply(null, dists);
        const target = targets[dists.indexOf(smallestDist)];
        return (target);
    }

    defend(mana, target) {
        const distanceToBase = this.getDistanceTo(this.defendBase);
        const distanceToTarget = this.getDistanceTo(target);
        const targetDistanceToBase = target.getDistanceTo(this.defendBase);

        this.setFocusOnEntity(target);
        if (mana > 10 && target.shieldLife == 0) {
            if (distanceToBase > targetDistanceToBase && distanceToTarget < 2200 && (distanceToTarget > 800 || targetDistanceToBase < 500)) {
                // target is closer to base than hero is but not in attackable range, move it back to hero
                Hero.control(target.id, this);
                return (3);
            }
            else if (target.isCriticallyInBaseCamp(this.defendBase) && distanceToTarget < 1280) {
                Hero.wind(this.attackBase);
                return (2);
            }
        }
        this.moveToFocusPoint();
        return (1);
    }

    act(mana, heroes, targets) {
        let focusedEntity = Entity.getById(targets, this.focusEntityId);
        if (!focusedEntity && this.focusEntityId > -1)
            this.clearFocusOnEntity();

        // if many targets nearby and in the basecamp, shoot them all back to the middle
        if (mana > 10 && this.isInBaseCamp(this.defendBase)) {
            let amountNearby = 0;
            for (const target of targets) {
                if (target.shieldLife == 0 && this.getDistanceTo(target) < 1280)
                    amountNearby++;
            }
            if (amountNearby >= 3) {
                Hero.wind(this.attackBase, 'NICE');
                return (2);
            }
        }

        // if focused monster is no longer in the basecamp, let go of focus
        if (focusedEntity && !focusedEntity.isInBaseCamp(this.defendBase)) {
            this.clearFocusOnEntity();
            focusedEntity = null;
        }

        // if current target is not in the critical part basecamp but there is one actually there, target it now!
        if (focusedEntity && !focusedEntity.isCriticallyInBaseCamp(this.defendBase)) {
            for (const target of targets) {
                if (target.isCriticallyInBaseCamp(this.defendBase) && !Hero.isAlreadyFocusedByOtherHero(heroes, target.id))
                    return (this.defend(mana, target));
            }
        }

        // go after existing target
        if (focusedEntity)
            return (this.defend(mana, focusedEntity));

        // if an enemy is near, protect
        if (mana > 10) {
            for (const target of targets) {
                if (this.getDistanceTo(target) < 3000 && target instanceof Opponent) {
                    if (this.shieldLife == 0) {
                        Hero.shield(this.id);
                        return (4);
                    }
                    else if (target.shieldLife == 0 && this.getDistanceTo(target) < 2200) {
                        Hero.control(target.id, this.attackBase);
                        return (3);
                    }
                }
            }
        }

        // find a target
        const closestTarget = this.findTarget(targets);
        if (closestTarget && closestTarget.isInBaseCamp(this.defendBase) && !Hero.isAlreadyFocusedByOtherHero(heroes, closestTarget.id))
            return (this.defend(mana, closestTarget));

        this.patrol();
        return (0);
    }
}

class Attacker extends Hero {
    constructor(defendBase, attackBase, inputs, heroNum) {
        super(defendBase, attackBase, inputs, heroNum, 5000, 12000, 5000);
    }

    nonSuitableTarget(target) {
        return (
            target instanceof Opponent ||
            target.shieldLife > 0 ||
            target.isInBaseCamp(this.defendBase)
        );
    }

    canProtect(mana, target) {
        return (
            mana > 10 &&
            target.threatFor == 2 &&
            target.shieldLife == 0 &&
            this.getDistanceTo(target) < 2200 &&
            target.getDistanceTo(this.attackBase) < 9000
        );
    }

    canControl(mana, target) {
        return (
            mana > 30 &&
            target.threatFor != 2 &&
            target.health > 10 &&
            this.getDistanceTo(target) < 2200 &&
            !target.isInBaseCamp(this.defendBase)
        )
    }

    findTarget(mana, targets) {
        const targetsNum = targets.length;
        const dists = new Array(targetsNum);
        dists.fill(Infinity);
        for (let i = 0; i < targetsNum; i++) {
            // override allow
            if (this.nonSuitableTarget(targets[i])) {
                continue;
            }

            // allow
            if (targets[i] instanceof Monster) {
                if (
                    targets[i].threatFor != 2 || this.canProtect(mana, targets[i])
                ) {
                    dists[i] = targets[i].getSmallestPossibleInterceptionDistance(this);
                }
            }
        }
        const smallestDist = Math.min.apply(null, dists);
        if (smallestDist == Infinity)
            return (null);
        const smallestIndex = dists.indexOf(smallestDist);
        const target = targets[smallestIndex];
        return (target)
    }

    attack(mana, target) {
        this.setFocusOnEntity(target);
        if (mana > 70) {
            if (this.canProtect(mana, target)) {
                Hero.shield(target.id);
                this.clearFocusOnEntity();
                return (4);
            }
            else if (this.canControl(mana, target)) {
                Hero.control(target.id, this.attackBase);
                this.clearFocusOnEntity();
                return (2);
            }
        }
        this.moveToFocusPoint();
        return (0);
    }

    act(mana, heroes, targets) {
        if (this.hasFocusEntity) {
            let focusedEntity = Entity.getById(targets, this.focusEntityId);
            if (!focusedEntity || focusedEntity.isInBaseCamp(this.defendBase))
                this.clearFocusOnEntity();
            else
                return (this.attack(mana, focusedEntity));
        }

        const target = this.findTarget(mana, targets);
        if (target)
            return (this.attack(mana, target));

        this.patrol();
        return (0);
    }
}

class Monster extends Entity {
    static steps = 11;
    static stepsInEachDir = Math.floor(Monster.steps / 2);

    constructor(inputs) {
        super(inputs);

        this.health = parseInt(inputs[6]); // Remaining health of this monster
        this.vx = parseInt(inputs[7]); // Trajectory of this monster
        this.vy = parseInt(inputs[8]);
        this.nearBase = parseInt(inputs[9]); // 0=monster with no target yet, 1=monster targeting a base
        this.threatFor = parseInt(inputs[10]); // Given this monster's trajectory, is it a threat to 1=your base, 2=your opponent's base, 0=neither

        this.trajectory = new Array(Monster.steps);
        this.trajectory[Monster.stepsInEachDir] = this.clonePosition();
        for (let i = 0; i < Monster.stepsInEachDir; i++) {
            const dist = Monster.stepsInEachDir - i;
            this.trajectory[i] = new Position(this.g.x - dist * this.vx, this.g.y - dist * this.vy);
        }
        for (let i = 1; i <= Monster.stepsInEachDir; i++) {
            const dist = Monster.stepsInEachDir + i;
            this.trajectory[dist] = new Position(this.g.x + i * this.vx, this.g.y + i * this.vy);
        }
    }

    getInterceptionDistances(from) {
        const dists = new Array(Monster.steps);
        dists.fill(Infinity);
        for (let i = 0; i < Monster.steps; i++) {
            const timeTillThere = (i <= Monster.stepsInEachDir ? 400 * (Monster.stepsInEachDir - i) : 400 * (i - Monster.stepsInEachDir));
            dists[i] = timeTillThere + from.getDistanceTo(this.trajectory[i]);
        }
        return (dists);
    }

    getSmallestPossibleInterceptionDistance(from) {
        const dists = this.getInterceptionDistances(from);
        const smallestDist = Math.min.apply(null, dists);
        return (smallestDist);
    }

    getBestInterceptPosition(from) {
        const dists = this.getInterceptionDistances(from);
        const smallestDist = Math.min.apply(null, dists);
        const target = this.trajectory[dists.indexOf(smallestDist)];
        return (target);
    }
}

class Opponent extends Entity {
    constructor(inputs) {
        super(inputs);
    }
}

class Base extends Position {
    constructor(x, y) {
        super(x, y);

        this.health = 3;
        this.mana = 0;
    }

    get isInTopLeft() {
        return (this.g.x == 0 && this.g.y == 0);
    }

    getPositionBasedOn(x, y) {
        if (this.isInTopLeft) {
            return (new Position(this.g.x + x, this.g.y + y));
        }
        return (new Position(this.g.x - x, this.g.y - y));
    }

    setHealth(health) {
        this.health = parseInt(health);
    }

    setMana(mana) {
        this.mana = parseInt(mana);
    }

    invertClone() {
        if (this.g.x == 0 && this.g.y == 0)
            return (new Base(17630, 9000));
        return (new Base(0, 0));
    }
}

// game init
let inputs = readline().split(' ');
const bases = new Array(2);
bases[0] = new Base(parseInt(inputs[0]), parseInt(inputs[1]));
bases[1] = bases[0].invertClone();

const heroesPerPlayer = parseInt(readline()); // Always 3
const heroes = new Array(heroesPerPlayer);

// game loop
while (true) {
    for (let i = 0; i < 2; i++) {
        let inputs = readline().split(' ');
        bases[i].setHealth(inputs[0]); // Each player's base health
        bases[i].setMana(inputs[1]); // Spend ten mana to cast a spell
    }

    const entityCount = parseInt(readline()); // Amount of heros and monsters you can see
    const entities = new Array(entityCount);
    let heroNum = 0;
    for (let i = 0; i < entityCount; i++) {
        let inputs = readline().split(' ');
        if (inputs[1] == 1) {
            if (heroes[heroNum]) {
                heroes[heroNum].update(inputs);
            }
            else {
                switch (heroNum) {
                    default: heroes[heroNum] = new Defender(bases[0], bases[1], inputs, heroNum); break;
                    case 2: heroes[heroNum] = new Attacker(bases[0], bases[1], inputs, heroNum); break;
                }
            }
            entities[i] = heroes[heroNum];
            heroNum++;
        }
        else if (inputs[1] == 2) {
            entities[i] = new Opponent(inputs);
        }
        else if (inputs[1] == 0) {
            entities[i] = new Monster(inputs);
        }
    }

    const targets = new Array(); // Array containing all targets
    for (const entity of entities) {
        if (entity instanceof Monster && (entity.isInBaseCamp(bases[0]) || entity.isNearBaseCamp(bases[0] || true)))
            targets.push(entity);
        else if (entity instanceof Opponent)
            targets.push(entity);
    }

    for (const hero of heroes) {
        const action = hero.act(bases[0].mana, heroes, targets);
        if (action == 2 || action == 3)
            bases[0].mana -= 10; // deplete mana when used action was a spell
    }
}
