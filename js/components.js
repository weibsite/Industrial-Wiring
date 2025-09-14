// --- COMPONENT CLASSES ---
class Component {
    constructor(x, y, type) { this.id = generateId(); this.x = snapToGrid(x); this.y = snapToGrid(y); this.type = type; this.width = 0; this.height = 0; this.connectors = []; this.isPowered = false; }
    setPoles(poleType) { this.poleType = poleType; this._updateDimensions(); this._rebuildConnectors(); }
    setRelayType(type) { this.relayType = type; this._updateDimensions(); this._rebuildConnectors(); }
    setMotorType(type) { this.motorType = type; this._updateDimensions(); this._rebuildConnectors(); }
    updatePosition(newX, newY) {
        this.x = newX;
        this.y = newY;
        this._rebuildConnectors(); // This updates the connector positions
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
    setSwitchType(type) { this.switchType = type; this.isPressed = false; this.position = 1; this._updateDimensions(); this._rebuildConnectors(); }
    draw(ctx) { throw new Error("Draw method must be implemented"); }
    isUnderMouse(mx, my) { return mx >= this.x && mx <= this.x + this.width && my >= this.y && my <= this.y + this.height; }
    getConnectorAt(mx, my) { for (const conn of this.connectors) { if (Math.hypot(conn.x - mx, conn.y - my) < GRID_SIZE / 2) return conn; } return null; }
    handleInteraction(x, y) { if (typeof this.toggle === 'function') this.toggle(); }
    toggle() {}
    _rebuildConnectors() { throw new Error("RebuildConnectors must be implemented for " + this.type); }
}

class NFB extends Component {
    constructor(x, y) { super(x, y, 'nfb'); this.poleType = '2P'; this.isOn = false; this._updateDimensions(); this._rebuildConnectors(); }
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
    toggle() { this.isOn = !this.isOn; }
    draw(ctx) {
        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2; ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = ctx.strokeStyle; ctx.font = `${GRID_SIZE*0.7}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('NFB', this.x + this.width / 2, this.y + GRID_SIZE * 0.7);
        ctx.fillText(this.poleType, this.x + this.width / 2, this.y + GRID_SIZE * 1.7);

        this.connectors.filter(c => c.type !== 'output').forEach(c => {
             ctx.fillStyle = '#a0aec0';
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
        this._updateColor();
        this._rebuildConnectors();
    }
    _rebuildConnectors() {
         this.connectors = [
            { id: `${this.id}-0`, parent: this, x: this.x + this.width / 2, y: this.y, potential: 0 },
            { id: `${this.id}-1`, parent: this, x: this.x + this.width / 2, y: this.y + this.height, potential: 0 }
        ];
    }
    _updateColor() { const c = bulbColors[this.colorIndex]; this.color = c.color; this.label = c.label; }
    cycleColor() { this.colorIndex = (this.colorIndex + 1) % bulbColors.length; this._updateColor(); }
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

        ctx.fillStyle = this.isPowered ? 'black' : this.color;
        ctx.font = `${GRID_SIZE*0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);
        ctx.shadowBlur = 0;

        this.connectors.forEach(c => {
            drawConnector(ctx, c);
        });
    }
}

class Switch extends Component {
    constructor(x, y) { super(x, y, 'switch'); this.switchType = 'pushbutton_no'; this.isPressed = false; this.position = 1; this._updateDimensions(); this._rebuildConnectors(); }
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
    toggle() {
        if (this.switchType === 'rotary_2pos') { this.position = (this.position === 1) ? 2 : 1; }
        else if (this.switchType === 'rotary_3pos') { this.position = (this.position % 3) + 1; }
    }
    press() { if (this.switchType.startsWith('pushbutton')) this.isPressed = true; }
    release() { if (this.switchType.startsWith('pushbutton')) this.isPressed = false; }
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
        ctx.fillText('按鈕', this.x + this.width/2, this.y + GRID_SIZE * 0.7);
        const typeLabel = this.switchType.endsWith('no') ? 'NO' : 'NC';
        ctx.fillText(typeLabel, this.x + this.width / 2, this.y + this.height - GRID_SIZE * 0.5);

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
    }
    _drawRotarySwitch(ctx) {
        ctx.fillStyle = this.connectors.some(c => c.potential !== 0) ? '#f6e05e' : '#a0aec0';
        ctx.fillText('旋轉', this.x + this.width/2, this.y + GRID_SIZE * 0.7);

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
        this.name = 'MC' + getNextContactorNumber();
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
    draw(ctx) {
        const a1 = this.connectors.find(c=>c.id===`${this.id}-A1`);
        const a2 = this.connectors.find(c=>c.id===`${this.id}-A2`);
        this.coilEnergized = (a1.potential === 1 && a2.potential === -1) || (a1.potential === -1 && a2.potential === 1);

        const baseIsPowered = this.connectors.some(c => c.potential !== 0);
        const offsetX = this.hasLeftAux ? GRID_SIZE * 3 : 0;
        ctx.strokeStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.lineWidth = 2;

        const mainBoxY = this.y + GRID_SIZE;
        const mainBoxHeight = GRID_SIZE * 5;
        ctx.strokeRect(this.x, mainBoxY, this.width, mainBoxHeight);

        ctx.fillStyle = baseIsPowered ? '#f6e05e' : '#a0aec0';
        ctx.font = `${GRID_SIZE*0.8}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, this.x - GRID_SIZE * 0.5, this.y + this.height / 2);

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

        ctx.fillStyle = this.isTripped ? '#ef4444' : (baseIsPowered ? '#f6e05e' : '#a0aec0');
        ctx.font = `${GRID_SIZE * 0.9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TH-RY', this.x + this.width/2, this.y + this.height/2);

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
    }
}

class Motor extends Component {
    constructor(x, y) {
        super(x, y, 'motor');
        this.name = 'M' + getNextMotorNumber();
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

        // Text
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = `${GRID_SIZE * 1.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, cx, cy);

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