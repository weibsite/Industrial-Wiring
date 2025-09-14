// --- COMPONENT CLASSES ---
class Component {
    constructor(x, y, type) { this.id = generateId(); this.x = snapToGrid(x); this.y = snapToGrid(y); this.type = type; this.width = 0; this.height = 0; this.connectors = []; this.isPowered = false; this.name = ''; }
    setPoles(poleType) { this.poleType = poleType; this._updateDimensions(); this._rebuildConnectors(); }
    setRelayType(type) { this.relayType = type; this._updateDimensions(); this._rebuildConnectors(); }
    setMotorType(type) { this.motorType = type; this._updateDimensions(); this._rebuildConnectors(); }
    setVariant(poleType, orientation) { if(typeof this._updateFromVariant === 'function') this._updateFromVariant(poleType, orientation); }
    updatePosition(newX, newY) {
        const dx = newX - this.x;
        const dy = newY - this.y;
        this.x = newX;
        this.y = newY;
        
        if (typeof this._rebuildConnectors === 'function') {
            this._rebuildConnectors();
        }

        wires.forEach(wire => {
            let segmentUpdated = false;
            if (wire.start.parent.id === this.id) {
                const p0 = wire.path[0];
                const p1 = wire.path[1];
                p0.x = wire.start.x;
                p0.y = wire.start.y;
                if (p1) {
                    if (Math.abs(p0.x - p1.x) < Math.abs(p0.y - p1.y)) { // Vertical segment
                        p1.x = p0.x;
                    } else { // Horizontal segment
                        p1.y = p0.y;
                    }
                }
                segmentUpdated = true;
            }
            if (wire.end.parent.id === this.id) {
                const pLast = wire.path[wire.path.length - 1];
                const pSecondLast = wire.path[wire.path.length - 2];
                pLast.x = wire.end.x;
                pLast.y = wire.end.y;
                if (pSecondLast) {
                    if (Math.abs(pLast.x - pSecondLast.x) < Math.abs(pLast.y - pSecondLast.y)) { // Vertical segment
                         pSecondLast.x = pLast.x;
                    } else { // Horizontal segment
                         pSecondLast.y = pLast.y;
                    }
                }
                segmentUpdated = true;
            }
        });
    }
    setSwitchType(type) { 
        this.switchType = type;
        this.isPressed = false;
        this.position = 1;
        this._updateDimensions();
        this._rebuildConnectors();
    }
    draw(ctx) { throw new Error("Draw method must be implemented"); }
    isUnderMouse(mx, my) { return mx >= this.x && mx <= this.x + this.width && my >= this.y && my <= this.y + this.height; }
    getConnectorAt(mx, my) { for (const conn of this.connectors) { if (Math.hypot(conn.x - mx, conn.y - my) < GRID_SIZE / 2) return conn; } return null; }
    handleInteraction(x, y) { if (typeof this.toggle === 'function') this.toggle(); }
    toggle() {}
    getInternalConnections() { return []; }
    _rebuildConnectors() { throw new Error("RebuildConnectors must be implemented for " + this.type); }
}

class NFB extends Component {
    constructor(x, y) { super(x, y, 'nfb'); this.poleType = '2P'; this.isOn = false; this.name = ''; this._updateDimensions(); this._rebuildConnectors(); }
    _updateDimensions() {
        let poleCount = 0;
        if (this.poleType === '1P') poleCount = 1;
        if (this.poleType === '2P') poleCount = 2;
        if (this.poleType === '3P') poleCount = 3;
        if (this.poleType === '4P') poleCount = 4;

        if (poleCount === 3) {
            this.width = GRID_SIZE * 6;
        } else if (poleCount === 4) {
            this.width = GRID_SIZE * 8;
        } else {
            this.width = GRID_SIZE * (poleCount + 1);
        }
        this.height = GRID_SIZE * 5;
    }
    _rebuildConnectors() {
        this.connectors = [];
        const labels = [];
        if (this.poleType === '1P') labels.push('L');
        if (this.poleType === '2P') labels.push('L', 'N');
        if (this.poleType === '3P') labels.push('R', 'S', 'T');
        if (this.poleType === '4P') labels.push('R', 'S', 'T', 'N');

        const poleCount = labels.length;

        labels.forEach((label, i) => {
             let xPos;
             if (poleCount >= 3) {
                xPos = this.x + GRID_SIZE + (i * GRID_SIZE * 2);
             } else {
                xPos = this.x + GRID_SIZE * (i + 1);
             }
             const isNeutral = label === 'N' || (this.poleType === '3P' && label === 'T');
             this.connectors.push({ id: `${this.id}-in-${i}`, parent: this, x: xPos, y: this.y, type: isNeutral ? 'neutral' : 'positive', pole: label, potential: 0 });
             this.connectors.push({ id: `${this.id}-out-${i}`, parent: this, x: xPos, y: this.y + this.height, type: 'output', pole: label, potential: 0 });
        });
    }
    
    /**
     * [FIXED] 修正 NFB 的互動行為.
     * 原始碼在 mousedown 和 click 事件都會觸發互動，導致狀態被切換兩次，看起來像沒反應。
     * 此修正讓 NFB 只在 click 事件時切換狀態，恢復正常的指撥開關行為。
     * @param {number} x - 滑鼠 x 座標
     * @param {number} y - 滑鼠 y 座標
     * @param {string} eventType - 事件類型 ('mousedown' 或 undefined)
     */
    handleInteraction(x, y, eventType) {
        // 只有在非 'mousedown' 事件時才切換狀態 (即 click 事件觸發時)。
        // 這樣可以避免 mousedown 和 click 連續觸發導致的雙重切換問題。
        if (eventType !== 'mousedown') {
            this.isOn = !this.isOn;
        }
    }

    getInternalConnections() {
        const connections = [];
        if (this.isOn) {
            this.connectors.filter(c => c.type === 'positive' || c.type === 'neutral').forEach(startConn => {
                const endConn = this.connectors.find(c => c.type === 'output' && c.pole === startConn.pole);
                if (startConn && endConn) connections.push([startConn, endConn]);
            });
        }
        return connections;
    }
    getNamePosition() {
        const fontSize = GRID_SIZE * 0.7;
        const textWidth = (this.name || 'NFB').length * fontSize * 0.7;
        return {
            x: this.x + this.width / 2 - textWidth / 2,
            y: this.y + GRID_SIZE * 0.7 - fontSize / 2,
            width: textWidth + 10,
            height: fontSize + 4,
            value: this.name,
            fontSize: fontSize
        };
    }
    draw(ctx) {
        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2; ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        this.connectors.filter(c => c.type !== 'output').forEach(c => {
             ctx.fillStyle = '#a0aec0';
             ctx.font = `${GRID_SIZE*0.7}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
             ctx.fillText(c.pole, c.x, this.y + GRID_SIZE * 2.8);
             const startY = this.y + GRID_SIZE * 3.5; const endY = this.y + this.height - GRID_SIZE;

             const outputConn = this.connectors.find(conn => conn.pole === c.pole && conn.type === 'output');

             let lineColor = '#a0aec0'; // Default gray
             if (outputConn && outputConn.potential !== 0) {
                 if (c.pole === 'N' || (this.poleType === '3P' && c.pole === 'T')) {
                     lineColor = '#4299e1'; // Blue
                 } else {
                     lineColor = '#f6e05e'; // Default energized yellow
                 }
             }
             ctx.strokeStyle = lineColor;

             ctx.beginPath(); ctx.moveTo(c.x, startY);
             if (this.isOn) { ctx.lineTo(c.x, endY); }
             else { ctx.lineTo(c.x + GRID_SIZE * 0.4, endY - GRID_SIZE * 0.4); }
             ctx.stroke();
        });

        // --- Text drawn last for visibility ---
        ctx.fillStyle = ctx.strokeStyle; ctx.font = `${GRID_SIZE*0.7}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const displayName = this.name || 'NFB';
        ctx.fillText(displayName, this.x + this.width / 2, this.y + GRID_SIZE * 0.7);
        ctx.fillText(this.poleType, this.x + this.width / 2, this.y + GRID_SIZE * 1.7);
        
        this.connectors.forEach(c => {
            drawConnector(ctx, c);
        });
    }
}

class Bulb extends Component {
    constructor(x, y, colorIndex = 0) {
        super(x, y, 'bulb');
        this.width = GRID_SIZE * 2;
        this.height = GRID_SIZE * 2;
        this.colorIndex = colorIndex;
        this.displayName = ''; // 用於顯示 PL1, PL2...
        this._updateColor();
        this._rebuildConnectors();
    }
    _rebuildConnectors() {
         this.connectors = [
            { id: `${this.id}-0`, parent: this, x: this.x + this.width / 2, y: this.y, potential: 0 },
            { id: `${this.id}-1`, parent: this, x: this.x + this.width / 2, y: this.y + this.height, potential: 0 }
        ];
    }
    // name 屬性 (RL, YL) 用於內部顏色邏輯
    _updateColor() { const c = bulbColors[this.colorIndex]; this.color = c.color; this.name = c.label; }
    cycleColor() { this.colorIndex = (this.colorIndex + 1) % bulbColors.length; this._updateColor(); }
    setName(newName) {
        const newColor = bulbColors.find(c => c.label.toLowerCase() === newName.toLowerCase());
        if (newColor) {
            this.color = newColor.color;
            this.name = newColor.label;
            this.colorIndex = bulbColors.findIndex(c => c.label === newColor.label);
        } else {
             // 如果輸入的不是顏色代碼，則更新顯示名稱
            this.displayName = newName.toUpperCase();
        }
    }
    getNamePosition() {
        const textToDisplay = this.displayName || this.name;
        const fontSize = GRID_SIZE * 0.9;
        const textWidth = textToDisplay.length * fontSize * 0.6;
        return {
            x: this.x + this.width / 2 - textWidth / 2,
            y: this.y + this.height / 2 - fontSize / 2,
            width: textWidth,
            height: fontSize,
            value: textToDisplay,
            fontSize: fontSize
        };
    }
    draw(ctx) {
        this.isPowered = (this.connectors[0].potential === 1 && this.connectors[1].potential === -1) || (this.connectors[0].potential === -1 && this.connectors[1].potential === 1);
        ctx.strokeStyle = this.isPowered ? this.color : '#a0aec0'; ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);

        ctx.shadowBlur = 0;
        if (this.isPowered) {
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        this.connectors.forEach(c => {
            drawConnector(ctx, c);
        });

        // --- Text drawn last for visibility ---
        const textToDisplay = this.displayName || this.name; // 優先顯示 displayName (PL1)
        ctx.fillStyle = this.isPowered ? 'black' : this.color;
        ctx.font = `${GRID_SIZE*0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(textToDisplay, this.x + this.width / 2, this.y + this.height / 2);
    }
}

class Switch extends Component {
    constructor(x, y) { super(x, y, 'switch'); this.switchType = 'pushbutton_no'; this.isPressed = false; this.position = 1; this.name = ''; this._updateDimensions(); this._rebuildConnectors(); }
    _updateDimensions() {
        if (this.switchType.startsWith('pushbutton')) {
            this.width = GRID_SIZE * 2;
            this.height = GRID_SIZE * 4;
        } else if (this.switchType === 'rotary_2pos') {
            this.width = GRID_SIZE * 5;
            this.height = GRID_SIZE * 5;
        } else if (this.switchType === 'rotary_3pos') {
            this.width = GRID_SIZE * 5;
            this.height = GRID_SIZE * 5;
        }
    }
    _rebuildConnectors() {
        this.connectors = []; const cX = this.x + this.width / 2;
        if (this.switchType.startsWith('pushbutton')) {
            this.connectors.push({ id: `${this.id}-in`, parent: this, x: cX, y: this.y, type: 'in', potential: 0 });
            this.connectors.push({ id: `${this.id}-out`, parent: this, x: cX, y: this.y + this.height, type: 'out', potential: 0 });
        } else if (this.switchType === 'rotary_2pos') {
            this.connectors.push({ id: `${this.id}-com`, parent: this, x: cX, y: this.y, type: 'com', potential: 0 });
            this.connectors.push({ id: `${this.id}-out_left`, parent: this, x: this.x + GRID_SIZE, y: this.y + this.height, type: 'out_left', potential: 0 });
            this.connectors.push({ id: `${this.id}-out_right`, parent: this, x: this.x + this.width - GRID_SIZE, y: this.y + this.height, type: 'out_right', potential: 0 });
        } else if (this.switchType === 'rotary_3pos') {
             this.connectors.push({ id: `${this.id}-com`, parent: this, x: cX, y: this.y, type: 'com', potential: 0 });
            this.connectors.push({ id: `${this.id}-out_left`, parent: this, x: this.x + GRID_SIZE, y: this.y + this.height, type: 'out_left', potential: 0 });
            this.connectors.push({ id: `${this.id}-out_middle`, parent: this, x: cX, y: this.y + this.height, type: 'out_middle', potential: 0 });
            this.connectors.push({ id: `${this.id}-out_right`, parent: this, x: this.x + this.width - GRID_SIZE, y: this.y + this.height, type: 'out_right', potential: 0 });
        }
    }
    getInternalConnections() {
        const connections = [];
        if (this.switchType.startsWith('pushbutton')) {
            const isNo = this.switchType.endsWith('no');
            const isClosed = (isNo && this.isPressed) || (!isNo && !this.isPressed);
            if (isClosed) connections.push([this.connectors[0], this.connectors[1]]);
        } else if (this.switchType === 'rotary_2pos') {
            const com = this.connectors.find(c => c.type === 'com');
            const out = this.position === 1 ? this.connectors.find(c => c.type === 'out_left') : this.connectors.find(c => c.type === 'out_right');
            if (com && out) connections.push([com, out]);
        } else if (this.switchType === 'rotary_3pos') {
            const com = this.connectors.find(c => c.type === 'com');
            let out = null;
            if (this.position === 1) out = this.connectors.find(c => c.type === 'out_left');
            if (this.position === 2) out = this.connectors.find(c => c.type === 'out_middle');
            if (this.position === 3) out = this.connectors.find(c => c.type === 'out_right');
            if (com && out) connections.push([com, out]);
        }
        return connections;
    }
    toggle() {
        if (this.switchType === 'rotary_2pos') { this.position = (this.position === 1) ? 2 : 1; }
        else if (this.switchType === 'rotary_3pos') { this.position = (this.position % 3) + 1; }
    }
    press() { if (this.switchType.startsWith('pushbutton')) this.isPressed = true; }
    release() { if (this.switchType.startsWith('pushbutton')) this.isPressed = false; }
    getNamePosition() {
        const fontSize = GRID_SIZE * 0.7;
        const textWidth = (this.name || '按鈕').length * fontSize * 0.7;
         return {
            x: this.x + this.width / 2 - textWidth / 2,
            y: this.y + GRID_SIZE * 0.7 - fontSize / 2,
            width: textWidth + 10,
            height: fontSize + 4,
            value: this.name,
            fontSize: fontSize
        };
    }
    draw(ctx) {
        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2;

        if (this.switchType.startsWith('rotary')) {
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }

        ctx.font = `${GRID_SIZE*0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (this.switchType.startsWith('pushbutton')) this._drawPushButton(ctx);
        else this._drawRotarySwitch(ctx);

        this.connectors.forEach(c => {
            drawConnector(ctx, c);
        });
    }
    _drawPushButton(ctx) {
        const cX = this.x + this.width / 2;
        const midY = this.y + this.height / 2;

        ctx.beginPath(); ctx.moveTo(cX, this.y + 5); ctx.lineTo(cX, midY - 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cX, this.y + this.height - 5); ctx.lineTo(cX, midY + 5); ctx.stroke();

        ctx.beginPath();
        const isNo = this.switchType.endsWith('no');
        const isClosed = (isNo && this.isPressed) || (!isNo && !this.isPressed);

        if (isClosed) { ctx.moveTo(cX, midY - 5); ctx.lineTo(cX, midY + 5); }
        else { ctx.moveTo(cX, midY - 5); ctx.lineTo(cX + 8, midY - 2); }
        ctx.stroke();

        // --- Text drawn last for visibility ---
        ctx.fillStyle = this.connectors.some(c => c.potential !== 0) ? '#f6e05e' : '#a0aec0';
        ctx.fillText(this.name || '按鈕', this.x + this.width/2, this.y + GRID_SIZE * 0.7);
        const typeLabel = this.switchType.endsWith('no') ? 'NO' : 'NC';
        ctx.fillText(typeLabel, this.x + this.width / 2, this.y + this.height - GRID_SIZE * 0.5);
    }
    _drawRotarySwitch(ctx) {
        ctx.fillStyle = this.connectors.some(c => c.potential !== 0) ? '#f6e05e' : '#a0aec0';
        ctx.fillText(this.name, this.x + this.width/2, this.y + GRID_SIZE * 0.7);

        const cX = this.x + this.width / 2;
        const cY = this.y + this.height / 2;
        const radius = (this.width / 2) * 0.7; // Radius for the indicator line

        ctx.beginPath();
        ctx.arc(cX, cY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#666';
        ctx.fill();

        let angle = 0;
        if (this.switchType === 'rotary_2pos') {
            angle = (this.position === 1) ? Math.PI * 0.8 : Math.PI * 0.2;
        } else if (this.switchType === 'rotary_3pos') {
            if (this.position === 1) angle = Math.PI * 0.8;
            else if (this.position === 2) angle = Math.PI * 0.5;
            else if (this.position === 3) angle = Math.PI * 0.2;
        }

        ctx.beginPath();
        ctx.moveTo(cX, cY);
        ctx.lineTo(cX + radius * Math.cos(angle), cY + radius * Math.sin(angle));
        ctx.strokeStyle = this.connectors.some(c => c.potential !== 0) ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.lineWidth = 2;
    }
}

class MagneticContactor extends Component {
    constructor(x, y) {
        super(x, y, 'contactor');
        this.name = '';
        this.coilEnergized = false;
        this.hasLeftAux = false;
        this._updateDimensions();
        this._rebuildConnectors();
    }
    _updateDimensions() {
        const baseWidth = GRID_SIZE * 9;
        const auxWidth = this.hasLeftAux ? GRID_SIZE * 3 : 0;
        this.width = baseWidth + auxWidth;
        this.height = GRID_SIZE * 6;
    }
    _rebuildConnectors() {
        this.connectors = [];
        const offsetX = this.hasLeftAux ? GRID_SIZE * 3 : 0;
        const coilY = this.y;
        const mainInY = this.y + GRID_SIZE * 2;
        const mainOutY = this.y + GRID_SIZE * 5;

        // A1, A2 Coil connectors
        this.connectors.push({ id: `${this.id}-A1`, parent: this, x: this.x + offsetX + GRID_SIZE * 2, y: coilY, type: 'coil', potential: 0 });
        this.connectors.push({ id: `${this.id}-A2`, parent: this, x: this.x + offsetX + GRID_SIZE * 4 , y: coilY, type: 'coil', potential: 0 });

        // Main contacts L1,L2,L3
        this.connectors.push({ id: `${this.id}-L1`, parent: this, x: this.x + offsetX + GRID_SIZE, y: mainInY, type: 'main-in', pole: 0, potential: 0 });
        this.connectors.push({ id: `${this.id}-L2`, parent: this, x: this.x + offsetX + GRID_SIZE * 3, y: mainInY, type: 'main-in', pole: 1, potential: 0 });
        this.connectors.push({ id: `${this.id}-L3`, parent: this, x: this.x + offsetX + GRID_SIZE * 5, y: mainInY, type: 'main-in', pole: 2, potential: 0 });

        // Main contacts T1,T2,T3
        this.connectors.push({ id: `${this.id}-T1`, parent: this, x: this.x + offsetX + GRID_SIZE, y: mainOutY, type: 'main-out', pole: 0, potential: 0 });
        this.connectors.push({ id: `${this.id}-T2`, parent: this, x: this.x + offsetX + GRID_SIZE * 3, y: mainOutY, type: 'main-out', pole: 1, potential: 0 });
        this.connectors.push({ id: `${this.id}-T3`, parent: this, x: this.x + offsetX + GRID_SIZE * 5, y: mainOutY, type: 'main-out', pole: 2, potential: 0 });

        // Right side built-in aux contacts
        this.connectors.push({ id: `${this.id}-aux-no-in`, parent: this, x: this.x + offsetX + GRID_SIZE * 7, y: mainInY, type: 'aux-no-in', potential: 0 });
        this.connectors.push({ id: `${this.id}-aux-no-out`, parent: this, x: this.x + offsetX + GRID_SIZE * 7, y: mainOutY, type: 'aux-no-out', potential: 0 });
        this.connectors.push({ id: `${this.id}-aux-nc-in`, parent: this, x: this.x + offsetX + GRID_SIZE * 8, y: mainInY, type: 'aux-nc-in', potential: 0 });
        this.connectors.push({ id: `${this.id}-aux-nc-out`, parent: this, x: this.x + offsetX + GRID_SIZE * 8, y: mainOutY, type: 'aux-nc-out', potential: 0 });

        // Left side add-on aux contacts
        if (this.hasLeftAux) {
            this.connectors.push({ id: `${this.id}-aux-left-nc-in`, parent: this, x: this.x + GRID_SIZE, y: mainInY, type: 'aux-left-nc-in', potential: 0 });
            this.connectors.push({ id: `${this.id}-aux-left-nc-out`, parent: this, x: this.x + GRID_SIZE, y: mainOutY, type: 'aux-left-nc-out', potential: 0 });
            this.connectors.push({ id: `${this.id}-aux-left-no-in`, parent: this, x: this.x + GRID_SIZE * 2, y: mainInY, type: 'aux-left-no-in', potential: 0 });
            this.connectors.push({ id: `${this.id}-aux-left-no-out`, parent: this, x: this.x + GRID_SIZE * 2, y: mainOutY, type: 'aux-left-no-out', potential: 0 });
        }
    }
    updateLogic() {
        const a1 = this.connectors.find(c => c.id === `${this.id}-A1`);
        const a2 = this.connectors.find(c => c.id === `${this.id}-A2`);
        this.coilEnergized = (a1.potential === 1 && a2.potential === -1) || (a1.potential === -1 && a2.potential === 1);
    }
    getInternalConnections() {
        const connections = [];
        if (this.coilEnergized) {
            for(let p=0; p<3; p++) {
                connections.push([this.connectors.find(c=>c.type==='main-in'&&c.pole===p), this.connectors.find(c=>c.type==='main-out'&&c.pole===p)]);
            }
            connections.push([this.connectors.find(c=>c.type==='aux-no-in'), this.connectors.find(c=>c.type==='aux-no-out')]);
            if(this.hasLeftAux) {
                connections.push([this.connectors.find(c=>c.type==='aux-left-no-in'), this.connectors.find(c=>c.type==='aux-left-no-out')]);
            }
        } else {
            connections.push([this.connectors.find(c=>c.type==='aux-nc-in'), this.connectors.find(c=>c.type==='aux-nc-out')]);
            if(this.hasLeftAux) {
                connections.push([this.connectors.find(c=>c.type==='aux-left-nc-in'), this.connectors.find(c=>c.type==='aux-left-nc-out')]);
            }
        }
        return connections.filter(p => p[0] && p[1]); // Filter out invalid pairs
    }
    getNamePosition() {
        const fontSize = GRID_SIZE * 0.8;
        const textWidth = (this.name || '').length * fontSize * 0.7 + 10;
        const textX = this.x - GRID_SIZE * 0.5; // Right aligned here
        return {
            x: textX - textWidth,
            y: this.y + this.height / 2 - fontSize / 2,
            width: textWidth,
            height: fontSize,
            value: this.name,
            fontSize: fontSize
        };
    }
    draw(ctx) {
        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        const offsetX = this.hasLeftAux ? GRID_SIZE * 3 : 0;
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2;

        const mainBoxY = this.y + GRID_SIZE;
        const mainBoxHeight = GRID_SIZE * 5;
        ctx.strokeRect(this.x, mainBoxY, this.width, mainBoxHeight);

        ctx.textAlign = 'center';
        ctx.font = `${GRID_SIZE*0.6}px sans-serif`;

        ctx.fillText('A1', this.x + offsetX + GRID_SIZE * 2, this.y - GRID_SIZE * 0.5);
        ctx.fillText('A2', this.x + offsetX + GRID_SIZE * 4, this.y - GRID_SIZE * 0.5);
        ctx.strokeRect(this.x + offsetX + GRID_SIZE * 2, this.y, GRID_SIZE * 2, GRID_SIZE);

        // Draw indicator square
        const squareSize = GRID_SIZE * 1.2;
        const squareX = this.x + offsetX + (GRID_SIZE*6)/2 - (squareSize/2); // Centered in the main 3P part
        const squareY = mainBoxY + mainBoxHeight / 2 - (squareSize / 2);
        ctx.fillStyle = this.coilEnergized ? '#1a202c' : '#718096'; // Black or Gray-600
        ctx.fillRect(squareX, squareY, squareSize, squareSize);
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.strokeRect(squareX, squareY, squareSize, squareSize);

        // Draw main contacts
        for (let i = 0; i < 3; i++) {
            const xPos = this.x + offsetX + GRID_SIZE + (i * GRID_SIZE * 2);
            const startY = mainBoxY + GRID_SIZE;
            const endY = mainBoxY + mainBoxHeight - GRID_SIZE;
            ctx.fillText(`L${i+1}`, xPos, startY - GRID_SIZE * 0.5);
            ctx.fillText(`T${i+1}`, xPos, endY + GRID_SIZE * 0.5);
            ctx.beginPath(); ctx.arc(xPos, startY, 3, 0, Math.PI * 2); ctx.moveTo(xPos, startY + 3); ctx.lineTo(xPos, startY + GRID_SIZE * 0.5); ctx.stroke();
            ctx.beginPath(); ctx.arc(xPos, endY, 3, 0, Math.PI * 2); ctx.moveTo(xPos, endY - 3); ctx.lineTo(xPos, endY - GRID_SIZE * 0.5); ctx.stroke();
            ctx.beginPath();
            if (this.coilEnergized) { ctx.moveTo(xPos, startY + GRID_SIZE * 0.5); ctx.lineTo(xPos, endY - GRID_SIZE * 0.5); }
            else { ctx.moveTo(xPos, startY + GRID_SIZE * 0.5); ctx.lineTo(xPos + 8, startY + GRID_SIZE * 0.5 - 3); }
            ctx.stroke();
        }

        // Separator between Main and Right Aux
        ctx.beginPath(); ctx.moveTo(this.x + offsetX + GRID_SIZE * 6, mainBoxY); ctx.lineTo(this.x + offsetX + GRID_SIZE * 6, mainBoxY + mainBoxHeight); ctx.stroke();

        // Draw Right Aux Contacts
        const auxStartY = mainBoxY + GRID_SIZE;
        const auxEndY = mainBoxY + mainBoxHeight - GRID_SIZE;
        // Right NO
        const noX = this.x + offsetX + GRID_SIZE * 7;
        ctx.fillText('NO', noX, auxStartY - GRID_SIZE * 0.5);
        ctx.fillText('14', noX, auxEndY + GRID_SIZE * 0.5); // Common numbering
        ctx.beginPath(); ctx.arc(noX, auxStartY, 3, 0, Math.PI * 2); ctx.moveTo(noX, auxStartY + 3); ctx.lineTo(noX, auxStartY + GRID_SIZE * 0.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(noX, auxEndY, 3, 0, Math.PI * 2); ctx.moveTo(noX, auxEndY - 3); ctx.lineTo(noX, auxEndY - GRID_SIZE * 0.5); ctx.stroke();
        ctx.beginPath();
        if (this.coilEnergized) { ctx.moveTo(noX, auxStartY + GRID_SIZE * 0.5); ctx.lineTo(noX, auxEndY - GRID_SIZE * 0.5); }
        else { ctx.moveTo(noX, auxStartY + GRID_SIZE * 0.5); ctx.lineTo(noX + 8, auxStartY + GRID_SIZE * 0.5 - 3); }
        ctx.stroke();

        // Right NC
        const ncX = this.x + offsetX + GRID_SIZE * 8;
        ctx.fillText('NC', ncX, auxStartY - GRID_SIZE * 0.5);
        ctx.fillText('22', ncX, auxEndY + GRID_SIZE * 0.5); // Common numbering
        ctx.beginPath(); ctx.arc(ncX, auxStartY, 3, 0, Math.PI * 2); ctx.moveTo(ncX, auxStartY + 3); ctx.lineTo(ncX, auxStartY + GRID_SIZE * 0.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(ncX, auxEndY, 3, 0, Math.PI * 2); ctx.moveTo(ncX, auxEndY - 3); ctx.lineTo(ncX, auxEndY - GRID_SIZE * 0.5); ctx.stroke();
        ctx.beginPath();
        if (!this.coilEnergized) {
            ctx.moveTo(ncX, auxStartY + GRID_SIZE * 0.5); ctx.lineTo(ncX, auxEndY - GRID_SIZE * 0.5);
            const midY = (auxStartY + auxEndY) / 2;
            ctx.moveTo(ncX - 4, midY - 8); ctx.lineTo(ncX + 4, midY + 8);
        } else { ctx.moveTo(ncX, auxStartY + GRID_SIZE * 0.5); ctx.lineTo(ncX + 8, auxStartY + GRID_SIZE * 0.5 - 3); }
        ctx.stroke();

        if (this.hasLeftAux) { /* Drawing for left aux omitted for brevity */ }

        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        const linkCoilY = this.y + GRID_SIZE;
        const linkSwitchY = this.y + GRID_SIZE * 2.5;
        ctx.moveTo(this.x + offsetX + this.width/4, linkCoilY);
        ctx.lineTo(this.x + offsetX + this.width/4, linkSwitchY - 5);
        ctx.stroke();
        ctx.setLineDash([]);
        
        this.connectors.forEach(c => {
            drawConnector(ctx, c);
        });

        // --- Text drawn last for visibility ---
        ctx.fillStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.font = `${GRID_SIZE*0.8}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, this.x - GRID_SIZE * 0.5, this.y + this.height / 2);
    }
}

class FuseHolder extends Component {
    constructor(x, y) {
        super(x, y, 'fuse');
        this.width = GRID_SIZE * 2;
        this.height = GRID_SIZE * 4;
        this.isBlown = false;
        this._rebuildConnectors();
    }
    _rebuildConnectors() {
        this.connectors = [
            { id: `${this.id}-in`, parent: this, x: this.x + this.width / 2, y: this.y, potential: 0 },
            { id: `${this.id}-out`, parent: this, x: this.x + this.width / 2, y: this.y + this.height, potential: 0 }
        ];
    }
    getInternalConnections() {
        return this.isBlown ? [] : [[this.connectors[0], this.connectors[1]]];
    }
    toggle() {
        this.isBlown = !this.isBlown;
    }
    draw(ctx) {
        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2;

        const cX = this.x + this.width / 2;
        ctx.strokeRect(this.x, this.y + GRID_SIZE, this.width, this.height - 2 * GRID_SIZE);
        ctx.beginPath();
        ctx.moveTo(cX, this.y); ctx.lineTo(cX, this.y + GRID_SIZE);
        ctx.moveTo(cX, this.y + this.height - GRID_SIZE); ctx.lineTo(cX, this.y + this.height);
        ctx.stroke();

        if (this.isBlown) {
            ctx.strokeStyle = '#e53e3e'; ctx.lineWidth = 3;
            const midY = this.y + this.height / 2;
            ctx.beginPath();
            ctx.moveTo(cX - 5, midY - 8); ctx.lineTo(cX + 5, midY);
            ctx.lineTo(cX - 5, midY); ctx.lineTo(cX + 5, midY + 8);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y + GRID_SIZE + 4);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height - GRID_SIZE - 4);
            ctx.stroke();
        }
        this.connectors.forEach(c => {
            drawConnector(ctx, c);
        });
    }
}

class ThermalOverloadRelay extends Component {
    constructor(x, y) {
        super(x, y, 'th-ry');
        this.isTripped = false;
        this.relayType = 'A'; // 'A' for standard, 'B' for common point
        this.isPressingTest = false;
        this.name = '';
        this._updateDimensions();
        this._rebuildConnectors();
    }

    _updateDimensions() {
        this.width = GRID_SIZE * 7;
        this.height = GRID_SIZE * 3;
        this.tripButtonRect = {
            x: this.x + GRID_SIZE * 0.5,
            y: this.y + this.height/2 - GRID_SIZE/2,
            width: GRID_SIZE,
            height: GRID_SIZE
        };
    }

    updatePosition(newX, newY){
        super.updatePosition(newX, newY);
        this._updateDimensions(); // Recalculate button position
    }

    _rebuildConnectors() {
        this.connectors = [];
        // Main contacts
        for (let i = 0; i < 3; i++) {
            const xPos = this.x + GRID_SIZE + (i * GRID_SIZE * 2);
            this.connectors.push({ id: `${this.id}-L${i+1}`, parent: this, x: xPos, y: this.y, type: 'main-in', pole: `L${i+1}`, potential: 0 });
            this.connectors.push({ id: `${this.id}-T${i+1}`, parent: this, x: xPos, y: this.y + this.height, type: 'main-out', pole: `T${i+1}`, potential: 0 });
        }

        // Aux contacts are tight with 3-grid height, placed closer
        if (this.relayType === 'A') { // Standard
            this.connectors.push({ id: `${this.id}-97`, parent: this, x: this.x + this.width, y: this.y + GRID_SIZE * 0.5, type: 'aux-no-in', pole: '97', potential: 0 });
            this.connectors.push({ id: `${this.id}-98`, parent: this, x: this.x + this.width, y: this.y + GRID_SIZE * 1.0, type: 'aux-no-out', pole: '98', potential: 0 });
            this.connectors.push({ id: `${this.id}-95`, parent: this, x: this.x + this.width, y: this.y + GRID_SIZE * 2.0, type: 'aux-nc-in', pole: '95', potential: 0 });
            this.connectors.push({ id: `${this.id}-96`, parent: this, x: this.x + this.width, y: this.y + GRID_SIZE * 2.5, type: 'aux-nc-out', pole: '96', potential: 0 });
        } else { // Common point
            this.connectors.push({ id: `${this.id}-95`, parent: this, x: this.x + this.width, y: this.y + GRID_SIZE * 0.5, type: 'aux-com', pole: '95', potential: 0 });
            this.connectors.push({ id: `${this.id}-96`, parent: this, x: this.x + this.width, y: this.y + GRID_SIZE * 1.5, type: 'aux-nc-out', pole: '96', potential: 0 });
            this.connectors.push({ id: `${this.id}-98`, parent: this, x: this.x + this.width, y: this.y + GRID_SIZE * 2.5, type: 'aux-no-out', pole: '98', potential: 0 });
        }
    }
    
    getInternalConnections() {
        const connections = [];
        // Main contacts are always connected
        for(let i=1; i<=3; i++) {
            connections.push([this.connectors.find(c=>c.pole===`L${i}`), this.connectors.find(c=>c.pole===`T${i}`)]);
        }
        // Aux contacts
        if (this.relayType === 'A') {
            if (this.isTripped) {
                connections.push([this.connectors.find(c=>c.pole==='97'), this.connectors.find(c=>c.pole==='98')]);
            } else {
                connections.push([this.connectors.find(c=>c.pole==='95'), this.connectors.find(c=>c.pole==='96')]);
            }
        } else {
            if(this.isTripped) {
                connections.push([this.connectors.find(c=>c.pole==='95'), this.connectors.find(c=>c.pole==='98')]);
            } else {
                connections.push([this.connectors.find(c=>c.pole==='95'), this.connectors.find(c=>c.pole==='96')]);
            }
        }
        return connections.filter(p => p[0] && p[1]);
    }

    handleInteraction(x, y) {
        const r = this.tripButtonRect;
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
            this.isTripped = true;
            this.isPressingTest = true;
            setTimeout(() => { this.isPressingTest = false; draw(); }, 200);
        } else if (this.isTripped) {
            this.isTripped = false; // Reset on main body click
        }
    }

    draw(ctx) {
        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        ctx.strokeStyle = this.isTripped ? '#ef4444' : (baseIsPowered ? '#f6e05e' : '#a0aec0');
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Draw Trip Test Button
        const btn = this.tripButtonRect;
        ctx.fillStyle = this.isTripped ? '#a0aec0' : (this.isPressingTest ? '#fef08a' : '#facc15');
        ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        ctx.strokeStyle = '#a0aec0';
        ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

        // Draw aux contacts representation on the right
        const auxX = this.x + this.width - GRID_SIZE;

        ctx.font = `${GRID_SIZE * 0.6}px sans-serif`;
        ctx.fillStyle = '#a0aec0';

        // NC contact (95-96)
        const ncY = this.y + this.height * 0.7;
        ctx.fillText('95', auxX, ncY - 10);
        ctx.fillText('96', auxX, ncY + 10);
        ctx.beginPath();
        if (this.isTripped) { // Open
            ctx.moveTo(auxX, ncY - 5); ctx.lineTo(auxX + 6, ncY - 2);
        } else { // Closed
            ctx.moveTo(auxX, ncY - 5); ctx.lineTo(auxX, ncY + 5);
        }
        ctx.stroke();

        // NO contact (97-98)
        const noY = this.y + this.height * 0.3;
        ctx.fillText('97', auxX, noY - 10);
        ctx.fillText('98', auxX, noY + 10);
        ctx.beginPath();
        if (this.isTripped) { // Closed
             ctx.moveTo(auxX, noY - 5); ctx.lineTo(auxX, noY + 5);
        } else { // Open
            ctx.moveTo(auxX, noY - 5); ctx.lineTo(auxX + 6, noY - 2);
        }
        ctx.stroke();

        // Draw trip indicator
        if (this.isTripped) {
            ctx.fillStyle = '#facc15'; // yellow-400
            ctx.beginPath();
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            ctx.moveTo(cx - 5, cy + 10);
            ctx.lineTo(cx + 5, cy - 5);
            ctx.lineTo(cx, cy - 5);
            ctx.lineTo(cx + 10, cy - 20);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + 5, cy);
            ctx.lineTo(cx - 5, cy + 10);
            ctx.closePath();
            ctx.fill();
        }
        
        this.connectors.forEach(c => {
            drawConnector(ctx, c);
        });

        // --- Text drawn last for visibility ---
        ctx.fillStyle = this.isTripped ? '#ef4444' : (baseIsPowered ? '#f6e05e' : '#a0aec0');
        ctx.font = `${GRID_SIZE * 0.9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, this.x + this.width/2, this.y + this.height/2);
    }
}

class Motor extends Component {
    constructor(x, y) {
        super(x, y, 'motor');
        this.name = '';
        this.motorType = '3-phase-6'; // Default
        this.isPowered = false;
        this.animationFrame = 0;
        this._updateDimensions();
        this._rebuildConnectors();
    }

    _updateDimensions() {
        this.width = GRID_SIZE * 6;
        if(this.motorType === '3-phase-6'){
            this.height = GRID_SIZE * 9;
        } else {
            this.height = GRID_SIZE * 6;
        }
    }

    _rebuildConnectors() {
        this.connectors = [];
        const cx = this.x + this.width / 2;
        const singleBottomRowY = this.y + this.height;
        const topRowY = this.y + this.height - GRID_SIZE * 4;
        const bottomRowY = this.y + this.height;

        switch (this.motorType) {
            case '3-phase-6':
                // Row 1: U1, V1, W1
                this.connectors.push({ id: `${this.id}-U1`, parent: this, x: this.x + GRID_SIZE, y: topRowY, pole: 'U1', potential: 0 });
                this.connectors.push({ id: `${this.id}-V1`, parent: this, x: cx, y: topRowY, pole: 'V1', potential: 0 });
                this.connectors.push({ id: `${this.id}-W1`, parent: this, x: this.x + this.width - GRID_SIZE, y: topRowY, pole: 'W1', potential: 0 });
                // Row 2: W2, U2, V2
                this.connectors.push({ id: `${this.id}-W2`, parent: this, x: this.x + GRID_SIZE, y: bottomRowY, pole: 'W2', potential: 0 });
                this.connectors.push({ id: `${this.id}-U2`, parent: this, x: cx, y: bottomRowY, pole: 'U2', potential: 0 });
                this.connectors.push({ id: `${this.id}-V2`, parent: this, x: this.x + this.width - GRID_SIZE, y: bottomRowY, pole: 'V2', potential: 0 });
                break;
            case '1-phase-3':
                 this.connectors.push({ id: `${this.id}-L1`, parent: this, x: this.x + GRID_SIZE, y: singleBottomRowY, pole: 'L1', potential: 0 });
                 this.connectors.push({ id: `${this.id}-N`, parent: this, x: cx, y: singleBottomRowY, pole: 'N', potential: 0 });
                 this.connectors.push({ id: `${this.id}-L2`, parent: this, x: this.x + this.width - GRID_SIZE, y: singleBottomRowY, pole: 'L2', potential: 0 });
                break;
            case '1-phase-2':
                 this.connectors.push({ id: `${this.id}-L`, parent: this, x: this.x + GRID_SIZE * 1.5, y: singleBottomRowY, pole: 'L', potential: 0 });
                 this.connectors.push({ id: `${this.id}-N`, parent: this, x: this.x + this.width - GRID_SIZE * 1.5, y: singleBottomRowY, pole: 'N', potential: 0 });
                break;
        }
    }

    getNamePosition() {
        const fontSize = GRID_SIZE * 1.5;
        const cx = this.x + this.width / 2;
        const cy = this.y + (GRID_SIZE * 5) / 2; // body height is 5 grids
        const textWidth = (this.name || '').length * fontSize * 0.6 + 10;
        return {
           x: cx - textWidth/2,
           y: cy - fontSize/2,
           width: textWidth,
           height: fontSize,
           value: this.name,
           fontSize: fontSize
        };
   }

    draw(ctx) {
        const bodyHeight = GRID_SIZE * 5;
        const cx = this.x + this.width / 2;
        const cy = this.y + bodyHeight / 2;
        const radius = this.width / 2 - GRID_SIZE;

        const poweredConnectors = this.connectors.filter(c => c.potential !== 0);
        this.isPowered = poweredConnectors.length >= 2;

        ctx.strokeStyle = this.isPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2;

        // Main body
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Rotation indicator
        if (this.isPowered) {
            this.animationFrame++;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(this.animationFrame * 0.1); // Speed of rotation
            ctx.beginPath();
            ctx.arc(0, 0, radius + 5, -0.5 * Math.PI, 0);
            ctx.stroke();
            // Arrowhead
            ctx.moveTo(radius + 5, -5);
            ctx.lineTo(radius + 10, 0);
            ctx.lineTo(radius + 5, 5);
            ctx.stroke();
            ctx.restore();
        } else {
            this.animationFrame = 0;
        }

        // Connectors
        this.connectors.forEach(c => {
            drawConnector(ctx, c);
            ctx.fillStyle = '#a0aec0';
            ctx.font = `${GRID_SIZE * 0.6}px sans-serif`;
            let yOffset = (c.y > this.y + this.height / 2) ? 12 : -12;
            ctx.fillText(c.pole, c.x, c.y + yOffset);
        });

        // --- Text drawn last for visibility ---
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = `${GRID_SIZE * 1.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, cx, cy);
    }
}

class TerminalBlock extends Component {
    constructor(x, y) {
        super(x, y, 'terminalBlock');
        this.poleType = '6P';
        this.orientation = 'vertical';
        this.name = '';
        this.namePos = null;
        this._updateFromVariant(this.poleType, this.orientation);
    }
    
    setVariant(poleType, orientation) {
        if (this.poleType !== poleType || this.orientation !== orientation) {
            wires = wires.filter(wire => wire.start.parent.id !== this.id && wire.end.parent.id !== this.id);
        }
        this._updateFromVariant(poleType, orientation);
    }

    _updateFromVariant(poleType, orientation) {
        this.poleType = poleType;
        this.orientation = orientation;

        const data = TERMINAL_BLOCK_DATA[this.orientation]?.[this.poleType];
        if (!data) {
             console.error(`找不到端子台資料: ${orientation}, ${poleType}`);
             this.drawingData = JSON.parse(JSON.stringify(TERMINAL_BLOCK_DATA['vertical']['6P']));
        } else {
            this.drawingData = JSON.parse(JSON.stringify(data));
        }
        
        const textEl = this.drawingData.drawingElements.find(el => el.type === 'text');
        if (textEl) {
            this.namePos = { x: textEl.x, y: textEl.y, font: textEl.font || '14px sans-serif' };
        } else {
            this.namePos = null;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.drawingData.drawingElements.forEach(el => {
            const elMinX = el.x;
            const elMinY = el.y;
            const elMaxX = el.x + (el.width || 0);
            const elMaxY = el.y + (el.height || 0);
            minX = Math.min(minX, elMinX);
            minY = Math.min(minY, elMinY);
            maxX = Math.max(maxX, elMaxX);
            maxY = Math.max(maxY, elMaxY);
        });
        
        this.minX = minX;
        this.minY = minY;
        this.width = snapToGrid(maxX - minX);
        this.height = snapToGrid(maxY - minY);

        this._rebuildConnectors();
    }

    _rebuildConnectors() {
        this.connectors = [];
        if (!this.drawingData) return;

        const connectorElements = this.drawingData.drawingElements.filter(el => el.type === 'connector');
        connectorElements.forEach(connEl => {
            this.connectors.push({
                id: `${this.id}-${connEl.id}`,
                originalId: connEl.id,
                parent: this,
                x: this.x + (connEl.x - this.minX),
                y: this.y + (connEl.y - this.minY),
                type: 'terminal',
                potential: 0
            });
        });
    }

    getInternalConnections() {
        const connections = [];
        if (this.drawingData) {
            this.drawingData.componentFunctions.forEach(func => {
                if (func.type === '相通') {
                    const conn1 = this.connectors.find(c => c.originalId === func.connectors[0]);
                    const conn2 = this.connectors.find(c => c.originalId === func.connectors[1]);
                    if (conn1 && conn2) connections.push([conn1, conn2]);
                }
            });
        }
        return connections;
    }

    getNamePosition() {
        if (!this.namePos) return null;

        const fontSize = GRID_SIZE * 0.8; 
        const x = this.x + (this.namePos.x - this.minX);
        const y = this.y + (this.namePos.y - this.minY) - 5;
        const textWidth = (this.name || '').length * fontSize * 0.6;

        return {
            x: x - textWidth / 2,
            y: y - fontSize / 2,
            width: textWidth + 10,
            height: fontSize + 4,
            value: this.name,
            fontSize: fontSize,
        };
    }

    draw(ctx) {
        if (!this.drawingData) return;
        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2;

        this.drawingData.drawingElements.forEach(el => {
            const x = this.x + (el.x - this.minX);
            const y = this.y + (el.y - this.minY);
            if (el.type === 'rect') {
                ctx.strokeRect(x, y, el.width, el.height);
            }
        });

        this.connectors.forEach(c => drawConnector(ctx, c));
        
        // --- Text drawn last for visibility ---
        if (this.namePos && this.name) {
            const x = this.x + (this.namePos.x - this.minX);
            const y = this.y + (this.namePos.y - this.minY) - 5; // 向上微調
            ctx.fillStyle = baseIsPowered ? '#f6e05e' : '#a0aec0'; // 再次確保顏色正確
            ctx.font = `bold ${GRID_SIZE * 0.8}px sans-serif`; // 加大字體並加粗
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.name, x, y);
        }
    }
}


class Wire {
    constructor(startConnector, endConnector, path) {
        this.id = generateId();
        this.start = startConnector;
        this.end = endConnector;
        this.potential = 0;
        this.color = defaultWireColor;
        this.thickness = defaultWireThickness;
        this.path = path;
    }
    calculatePath() {
        if (!this.start || !this.end || !this.path || this.path.length === 0) return;
        this.path[0].x = this.start.x;
        this.path[0].y = this.start.y;
        this.path[this.path.length - 1].x = this.end.x;
        this.path[this.path.length - 1].y = this.end.y;
    }
    draw(ctx) {
        if (!this.path || this.path.length < 2) return;
        if (this.potential === 1) ctx.strokeStyle = '#f6e05e'; else if (this.potential === -1) ctx.strokeStyle = '#4299e1'; else ctx.strokeStyle = this.color;
        ctx.lineWidth = this.thickness; ctx.beginPath(); ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) { ctx.lineTo(this.path[i].x, this.path[i].y); }
        ctx.stroke();
    }
}

class Relay extends Component {
    constructor(x, y) {
        super(x, y, 'relay');
        this.relayType = '2C';
        this.data = null;
        this.minX = 0;
        this.minY = 0;
        this.isEnergized = false;
        this.timers = {};
        this.knobs = {};
        this.adjustingKnobId = null;
        this.name = '';

        this.setRelayType(this.relayType);
    }
    
    setRelayType(type) {
        this.relayType = type;
        this.data = JSON.parse(JSON.stringify(RELAY_DATA[type])); // Deep copy
        if (!this.data) {
            console.error(`找不到繼電器資料: ${type}`);
            return;
        }

        // Reset state
        this.isEnergized = false;
        this.timers = {};
        this.knobs = {};
        this.adjustingKnobId = null;

        this._updateDimensions();
        this._rebuildConnectors();
    }

    _updateDimensions() {
        if (!this.data) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.data.drawingElements.forEach(el => {
            const elMinX = el.x1 !== undefined ? Math.min(el.x1, el.x2) : (el.x - (el.radius || 0));
            const elMinY = el.y1 !== undefined ? Math.min(el.y1, el.y2) : (el.y - (el.radius || 0));
            const elMaxX = el.x1 !== undefined ? Math.max(el.x1, el.x2) : (el.x + (el.width || el.radius || 0));
            const elMaxY = el.y1 !== undefined ? Math.max(el.y1, el.y2) : (el.y + (el.height || el.radius || 0));
            minX = Math.min(minX, elMinX);
            minY = Math.min(minY, elMinY);
            maxX = Math.max(maxX, elMaxX);
            maxY = Math.max(maxY, elMaxY);
        });

        this.minX = minX;
        this.minY = minY;
        this.width = snapToGrid(maxX - minX);
        this.height = snapToGrid(maxY - minY);
    }

    _rebuildConnectors() {
        if (!this.data) return;
        this.connectors = [];
        this.knobs = {};
        this.timers = {};

        this.data.drawingElements.forEach(el => {
            if (el.type === 'connector') {
                this.connectors.push({
                    id: `${this.id}-${el.id}`,
                    originalId: el.id,
                    parent: this,
                    x: this.x + (el.x - this.minX),
                    y: this.y + (el.y - this.minY),
                    type: 'relay-terminal',
                    potential: 0
                });
            } else if (el.type === 'knob') {
                this.knobs[el.id] = {
                    x: el.x - this.minX,
                    y: el.y - this.minY,
                    radius: el.radius,
                    value: el.value || 0,
                    maxValue: el.maxValue || 10
                };
            }
        });
        
        // Initialize timers based on functions
        this.data.componentFunctions.forEach(func => {
            if (func.type.startsWith('timed-') && func.knobId) {
                this.timers[`timer_${func.knobId}`] = { active: false, elapsed: 0, delay: 0 };
            }
        });
    }
    
    updatePosition(newX, newY) {
        super.updatePosition(newX, newY);
        this._rebuildConnectors(); // Re-calculate connector positions
    }

    updateLogic(deltaTime) {
        if (!this.data) return;

        // 1. Determine coil state
        const coilFunc = this.data.componentFunctions.find(f => f.type === 'coil');
        let isEnergizedThisFrame = false;
        if (coilFunc) {
            const conn1 = this.connectors.find(c => c.originalId === coilFunc.connectors[0]);
            const conn2 = this.connectors.find(c => c.originalId === coilFunc.connectors[1]);
            if (conn1 && conn2 && conn1.potential !== 0 && conn2.potential !== 0 && conn1.potential !== conn2.potential) {
                isEnergizedThisFrame = true;
            }
        }
        
        const wasEnergized = this.isEnergized;
        this.isEnergized = isEnergizedThisFrame;

        // 2. Update timers
        for (const timerKey in this.timers) {
            const timer = this.timers[timerKey];
            const knobId = timerKey.split('_')[1];
            const knob = this.knobs[knobId];

            if (this.isEnergized) {
                if (!wasEnergized) { // Just turned ON
                    timer.active = true;
                    timer.delay = (knob ? knob.value : 0) * 1000;
                    timer.elapsed = 0;
                }
                if (timer.active) {
                    timer.elapsed += deltaTime;
                }
            } else { // Not energized
                timer.active = false;
                timer.elapsed = 0;
            }
        }
    }

    getInternalConnections() {
        if (!this.data) return [];
        const connections = [];

        this.data.componentFunctions.forEach(func => {
            const conn1 = this.connectors.find(c => c.originalId === func.connectors[0]);
            const conn2 = this.connectors.find(c => c.originalId === func.connectors[1]);
            if (!conn1 || !conn2) return;

            let shouldConnect = false;
            switch (func.type) {
                case 'a-contact':
                    if (this.isEnergized) shouldConnect = true;
                    break;
                case 'b-contact':
                    if (!this.isEnergized) shouldConnect = true;
                    break;
                case 'timed-a-contact': {
                    const timer = this.timers[`timer_${func.knobId}`];
                    if (timer && timer.active && timer.elapsed >= timer.delay) {
                        shouldConnect = true;
                    }
                    break;
                }
                case 'timed-b-contact': {
                    const timer = this.timers[`timer_${func.knobId}`];
                    if (!this.isEnergized || (timer && this.isEnergized && timer.elapsed < timer.delay)) {
                         shouldConnect = true;
                    }
                    break;
                }
            }
            if (shouldConnect) {
                connections.push([conn1, conn2]);
            }
        });
        return connections;
    }
    
    handleInteraction(x, y, eventType, worldPos) {
        if (eventType === 'mousedown') {
            for (const id in this.knobs) {
                const knob = this.knobs[id];
                const knobWorldX = this.x + knob.x;
                const knobWorldY = this.y + knob.y;
                if (Math.hypot(worldPos.x - knobWorldX, worldPos.y - knobWorldY) < knob.radius * 0.5) {
                    this.adjustingKnobId = id;
                    return true;
                }
            }
        } else if (eventType === 'mousemove' && this.adjustingKnobId) {
            const knob = this.knobs[this.adjustingKnobId];
            const knobWorldX = this.x + knob.x;
            const knobWorldY = this.y + knob.y;

            const dx = worldPos.x - knobWorldX;
            const dy = worldPos.y - knobWorldY;
            let angle = Math.atan2(dy, dx);

            const startAngle = Math.PI * 0.75;
            const endAngle = Math.PI * 2.25;

            if (angle < startAngle - Math.PI) angle += Math.PI * 2;
            
            const clampedAngle = Math.max(startAngle, Math.min(angle, endAngle));
            const totalAngleRange = endAngle - startAngle;
            const valueRatio = (clampedAngle - startAngle) / totalAngleRange;
            
            knob.value = Math.round(valueRatio * knob.maxValue);
            return true;
        } else if (eventType === 'mouseup') {
            if (this.adjustingKnobId) {
                this.adjustingKnobId = null;
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        if (!this.data) return;
        const baseIsPowered = this.connectors.some(c => c.potential !== 0) || this.isEnergized;
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        this.data.drawingElements.forEach(el => {
            const x = this.x + (el.x - this.minX);
            const y = this.y + (el.y - this.minY);
            
            switch(el.type) {
                case 'rect': ctx.strokeRect(x, y, el.width, el.height); break;
                case 'circle': ctx.beginPath(); ctx.arc(x, y, el.radius, 0, Math.PI * 2); ctx.stroke(); break;
                case 'line': ctx.beginPath(); ctx.moveTo(this.x + el.x1 - this.minX, this.y + el.y1 - this.minY); ctx.lineTo(this.x + el.x2 - this.minX, this.y + el.y2 - this.minY); ctx.stroke(); break;
                case 'text': ctx.font = el.font || '16px sans-serif'; ctx.fillText(el.content.replace('(X)', `(${this.name})`), x, y); break;
                case 'knob': this._drawKnob(ctx, x, y, el); break;
            }
        });

        this.connectors.forEach(c => drawConnector(ctx, c));
    }
    
    _drawKnob(ctx, x, y, knobData) {
        const knobState = this.knobs[knobData.id];
        if (!knobState) return;

        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#a0aec0';
        
        ctx.beginPath();
        ctx.arc(x, y, knobState.radius, startAngle, endAngle);
        ctx.stroke();

        const handleRadius = knobState.radius * 0.4;
        ctx.beginPath();
        ctx.arc(x, y, handleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#a0aec0';
        ctx.fill();
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2d3748';
        const totalAngle = endAngle - startAngle;
        const valueRatio = knobState.value / knobState.maxValue;
        const pointerAngle = startAngle + valueRatio * totalAngle;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + handleRadius * Math.cos(pointerAngle), y + handleRadius * Math.sin(pointerAngle));
        ctx.stroke();

        ctx.fillStyle = this.isEnergized ? '#f6e05e' : '#a0aec0';
        ctx.font = `${Math.min(14, knobState.radius * 0.6)}px sans-serif`;
        ctx.fillText(knobState.value.toFixed(0), x, y - knobState.radius - 8);
        ctx.restore();
    }
}
