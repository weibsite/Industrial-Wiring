// --- SETUP ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const toolbar = document.getElementById('toolbar');
const canvasContainer = document.getElementById('canvas-container');
const wireColorPicker = document.getElementById('wire-color-picker');
const wireThicknessPicker = document.getElementById('wire-thickness-picker');

const contactorEditModal = document.getElementById('contactor-edit-modal');
const addAuxContactBtn = document.getElementById('add-aux-contact');
const removeAuxContactBtn = document.getElementById('remove-aux-contact');
const closeContactorEditModalBtn = document.getElementById('close-contactor-edit-modal');
const contactorNameInput = document.getElementById('contactor-name-input');

const poleModal = document.getElementById('pole-modal');
const poleModalTitle = document.getElementById('pole-modal-title');
const poleOptionsContainer = document.getElementById('pole-options');
const closePoleModalBtn = document.getElementById('close-pole-modal');

const switchModal = document.getElementById('switch-modal');
const closeSwitchModalBtn = document.getElementById('close-switch-modal');

const thRyModal = document.getElementById('th-ry-modal');
const closeThRyModalBtn = document.getElementById('close-th-ry-modal');

const motorModal = document.getElementById('motor-modal');
const closeMotorModalBtn = document.getElementById('close-motor-modal');

const saveButton = document.getElementById('save-button');
const loadButton = document.getElementById('load-button');
const fileInput = document.getElementById('file-input');

const GRID_SIZE = 20;
let components = [];
let wires = [];
let nextId = 0;

// --- State Management ---
let activeToolType = null;
let draggedToolType = null;
let draggedGhost = null;
let placementPreview = null; // Also used for dragging previews
let isDraggingPreview = false;
let wiringState = { start: null, end: null };
let wiringPathPoints = [];
let selectedComponent = null; // For selection box and deletion
let selectedComponentForEdit = null;
let draggedComponent = null;
let isPressingButton = false;
let dragOffset = { x: 0, y: 0 };
let longPressTimer = null;
let isLongPressDrag = false;
let potentialDragComponent = null;
let longPressStartPos = { x: 0, y: 0 };
let justDragged = false;

// Viewport state for zoom and pan
let view = { scale: 1.0, tx: 0, ty: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let pinchState = { active: false, initialDist: 0 };

// Double tap state for touch
let lastTap = 0;
let lastTapPos = null;


// --- Wire Settings ---
let defaultWireColor = '#f6e05e';
let defaultWireThickness = 3;
const WIRE_DEFAULT_COLORS = ['#f6e05e', '#e53e3e', '#4299e1', '#48bb78', '#1a202c'];
let wireColorIndex = 0;

// Inline Wire editing
let selectedWire = null;
let wireEditorUI = { colorRect: null, thickRect: null, deleteRect: null };
const WIRE_COLORS = {
    '#f6e05e': '#e53e3e', '#e53e3e': '#4299e1', '#4299e1': '#48bb78',
    '#48bb78': '#1a202c', '#1a202c': '#f6e05e',
};
const WIRE_THICKNESS = { 3: 6, 6: 3 };

let nextBulbColorIndex = 0;
const bulbColors = [
    { color: '#f6e05e', label: 'YL' }, { color: '#e53e3e', label: 'RL' }, { color: '#4299e1', label: 'BL' },
    { color: '#48bb78', label: 'GL' }, { color: '#ed8936', label: 'OL' },
];

// --- UTILITY & HELPER FUNCTIONS ---
const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;
const getCanvasMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    // Transform screen coordinates to world coordinates based on pan and zoom
    const worldX = (screenX - view.tx) / view.scale;
    const worldY = (screenY - view.ty) / view.scale;
    return { x: worldX, y: worldY };
};
const generateId = () => nextId++;

function pDistance(x, y, x1, y1, x2, y2) {
    const A = x - x1; const B = y - y1; const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D; const len_sq = C * C + D * D;
    let param = -1; if (len_sq != 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.sqrt(Math.pow(x - xx, 2) + Math.pow(y - yy, 2));
}

function checkCollision(rect1, ignoreId = -1) {
    for (const component of components) {
        if (component.id === ignoreId) continue;
        const rect2 = { x: component.x, y: component.y, width: component.width, height: component.height };
        if (rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y) {
            return true; // Collision detected
        }
    }
    return false; // No collision
}

function createTempComponent(type, x, y){
    switch (type) {
        case 'nfb': return new NFB(x, y);
        case 'bulb': return new Bulb(x, y, nextBulbColorIndex);
        case 'switch': return new Switch(x, y);
        case 'contactor': return new MagneticContactor(x, y);
        case 'fuse': return new FuseHolder(x, y);
        case 'th-ry': return new ThermalOverloadRelay(x,y);
        case 'motor': return new Motor(x,y);
        default: return null;
    }
}

// --- CANVAS RESIZING & DRAWING ---
function resizeCanvas() {
    canvas.width = canvasContainer.clientWidth;
    canvas.height = canvasContainer.clientHeight;
    draw();
}

function drawConnector(ctx, c) {
    const radius = 6;
    const scaledRadius = radius / view.scale;
    const scaledLineWidth = 1.5 / view.scale;

    // Determine colors
    const fillColor = c.potential !== 0 ? (c.potential === 1 ? '#f6e05e' : '#4299e1') : '#2d3748'; // bg-gray-800
    const strokeColor = c.potential !== 0 ? (c.potential === 1 ? '#f6e05e' : '#4299e1') : '#a0aec0'; // gray-500

    ctx.lineWidth = scaledLineWidth;

    // Outer circle
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cross
    ctx.strokeStyle = strokeColor;
    ctx.beginPath();
    ctx.moveTo(c.x - radius, c.y);
    ctx.lineTo(c.x + radius, c.y);
    ctx.moveTo(c.x, c.y - radius);
    ctx.lineTo(c.x, c.y + radius);
    ctx.stroke();
}

function drawGrid() {
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 0.5 / view.scale; // Keep line width visually constant

    // Get the visible area in world coordinates
    const left = -view.tx / view.scale;
    const top = -view.ty / view.scale;
    const right = (canvas.width - view.tx) / view.scale;
    const bottom = (canvas.height - view.ty) / view.scale;

    // Calculate the first grid line to draw
    const firstX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    const firstY = Math.floor(top / GRID_SIZE) * GRID_SIZE;

    for (let x = firstX; x <= right; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }
    for (let y = firstY; y <= bottom; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
}

function drawWireEditor(ctx) {
    if (!selectedWire) {
        wireEditorUI = { colorRect: null, thickRect: null, deleteRect: null };
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedWire.path.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;

    const uiX = centerX + 15; const uiY = centerY - 10;
    const swatchSize = 20; const buttonWidth = 30; const buttonHeight = 20; const padding = 5;

    ctx.fillStyle = selectedWire.color;
    ctx.fillRect(uiX, uiY, swatchSize, swatchSize);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 1 / view.scale;
    ctx.strokeRect(uiX, uiY, swatchSize, swatchSize);
    wireEditorUI.colorRect = { x: uiX, y: uiY, width: swatchSize, height: swatchSize };

    const thickButtonX = uiX + swatchSize + padding;
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(thickButtonX, uiY, buttonWidth, buttonHeight);
    ctx.strokeStyle = 'white'; ctx.strokeRect(thickButtonX, uiY, buttonWidth, buttonHeight);
    ctx.fillStyle = 'white'; ctx.font = `${12 / view.scale}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const thickText = selectedWire.thickness === 3 ? '細' : '粗';
    ctx.fillText(thickText, thickButtonX + buttonWidth / 2, uiY + buttonHeight / 2);
    wireEditorUI.thickRect = { x: thickButtonX, y: uiY, width: buttonWidth, height: buttonHeight };

    const deleteButtonX = thickButtonX + buttonWidth + padding;
    ctx.fillStyle = '#e53e3e';
    ctx.fillRect(deleteButtonX, uiY, buttonWidth, buttonHeight);
    ctx.strokeStyle = 'white'; ctx.strokeRect(deleteButtonX, uiY, buttonWidth, buttonHeight);
    ctx.fillStyle = 'white';
    ctx.fillText('刪', deleteButtonX + buttonWidth / 2, uiY + buttonHeight / 2);
    wireEditorUI.deleteRect = { x: deleteButtonX, y: uiY, width: buttonWidth, height: buttonHeight };
}

function getPreviewPath() {
    const path = [...wiringPathPoints];
    if (!wiringState.end) return path;
    const lastPoint = path[path.length - 1];
    const mousePoint = wiringState.end;

    const elbowPoint = { x: snapToGrid(mousePoint.x), y: lastPoint.y };
    const finalPoint = { x: snapToGrid(mousePoint.x), y: snapToGrid(mousePoint.y) };

    if(lastPoint.x !== elbowPoint.x) path.push(elbowPoint);
    if(elbowPoint.y !== finalPoint.y) path.push(finalPoint);

    return path;
}

function draw() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply view transformations (pan and zoom)
    ctx.translate(view.tx, view.ty);
    ctx.scale(view.scale, view.scale);

    // --- All world-space drawing happens here ---
    drawGrid();
    runSimulation();
    wires.forEach(w => w.draw(ctx));

    if(selectedWire){
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = selectedWire.thickness + 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if(selectedWire.path.length > 0) {
             ctx.moveTo(selectedWire.path[0].x, selectedWire.path[0].y);
             for (let i = 1; i < selectedWire.path.length; i++) { ctx.lineTo(selectedWire.path[i].x, selectedWire.path[i].y); }
        }
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    if (selectedComponent) {
        ctx.strokeStyle = '#a0aec0'; // gray-500
        ctx.lineWidth = 2 / view.scale;
        ctx.setLineDash([6 / view.scale, 3 / view.scale]);
        ctx.strokeRect(selectedComponent.x - 4, selectedComponent.y - 4, selectedComponent.width + 8, selectedComponent.height + 8);
        ctx.setLineDash([]);
    }

    components.forEach(c => c.draw(ctx));

    const previewComponent = placementPreview || draggedGhost;
    if (previewComponent) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        const tempComp = createTempComponent(previewComponent.type, previewComponent.x, previewComponent.y);
        if (tempComp) {
            if (previewComponent.isColliding) {
                ctx.strokeStyle = '#ef4444'; // Red for collision
                ctx.lineWidth = 2 / view.scale;
                ctx.strokeRect(tempComp.x, tempComp.y, tempComp.width, tempComp.height);
            }
            tempComp.draw(ctx);
        }
        ctx.restore();
    }

    if (draggedComponent) {
        ctx.strokeStyle = '#e53e3e';
        ctx.lineWidth = 2 / view.scale;
        ctx.setLineDash([6 / view.scale, 3 / view.scale]);
        ctx.strokeRect(draggedComponent.x - 2, draggedComponent.y - 2, draggedComponent.width + 4, draggedComponent.height + 4);
        ctx.setLineDash([]);
    }

    if (activeToolType === 'wire' && wiringState.start && wiringState.end) {
        const previewPath = getPreviewPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = defaultWireThickness;
        ctx.beginPath();
        if(previewPath.length > 0) {
            ctx.moveTo(previewPath[0].x, previewPath[0].y);
            for(let i=1; i < previewPath.length; i++) {
                if (previewPath[i]) ctx.lineTo(previewPath[i].x, previewPath[i].y);
            }
        }
        ctx.stroke();
    }

    drawWireEditor(ctx);

    // Restore the context to its original state
    ctx.restore();
}

// --- SIMULATION LOGIC ---
function runSimulation() {
    components.forEach(c => c.connectors.forEach(conn => conn.potential = 0));
    wires.forEach(w => w.potential = 0);

    const powerSources = components.filter(c => c.type === 'nfb');
    if (powerSources.length === 0) return;

    [1, -1].forEach(potential => {
        let queue = [];
        powerSources.forEach(nfb => {
            const startConnectors = nfb.connectors.filter(c => (potential === 1 && c.type === 'positive') || (potential === -1 && c.type === 'neutral') );
            startConnectors.forEach(c => { c.potential = potential; queue.push(c); });
        });

        let visitedConnectors = new Set(queue.map(c => c.id));

        while (queue.length > 0) {
            const currentConn = queue.shift();

            wires.forEach(w => {
                let otherConn = null;
                if (w.start.id === currentConn.id) otherConn = w.end;
                if (w.end.id === currentConn.id) otherConn = w.start;

                if (otherConn && !visitedConnectors.has(otherConn.id)) {
                    w.potential = potential; otherConn.potential = potential;
                    visitedConnectors.add(otherConn.id); queue.push(otherConn);
                }
            });

            const comp = currentConn.parent;
            let internalConnections = [];
            if (comp.type === 'fuse' && !comp.isBlown) internalConnections.push([comp.connectors[0], comp.connectors[1]]);

            if (comp.type === 'switch') {
                if (comp.switchType.startsWith('pushbutton')) {
                    const isNo = comp.switchType.endsWith('no');
                    const isClosed = (isNo && comp.isPressed) || (!isNo && !this.isPressed);
                    if (isClosed) internalConnections.push([comp.connectors[0], comp.connectors[1]]);
                } else if (comp.switchType === 'rotary_2pos') {
                    if (comp.position === 1) internalConnections.push([comp.connectors.find(c=>c.type==='com'), comp.connectors.find(c=>c.type==='out_left')]);
                    else internalConnections.push([comp.connectors.find(c=>c.type==='com'), comp.connectors.find(c=>c.type==='out_right')]);
                } else if (comp.switchType === 'rotary_3pos') {
                    if (comp.position === 1) internalConnections.push([comp.connectors.find(c=>c.type==='com'), comp.connectors.find(c=>c.type==='out_left')]);
                    if (comp.position === 2) internalConnections.push([comp.connectors.find(c=>c.type==='com'), comp.connectors.find(c=>c.type==='out_middle')]);
                    if (comp.position === 3) internalConnections.push([comp.connectors.find(c=>c.type==='com'), comp.connectors.find(c=>c.type==='out_right')]);
                }
            }
            if (comp.type === 'contactor') {
                const isCoilEnergized = comp.coilEnergized;
                if (isCoilEnergized) {
                    for(let p=0; p<3; p++) {
                         internalConnections.push([comp.connectors.find(c=>c.type==='main-in'&&c.pole===p), comp.connectors.find(c=>c.type==='main-out'&&c.pole===p)]);
                    }
                    internalConnections.push([comp.connectors.find(c=>c.type==='aux-no-in'), comp.connectors.find(c=>c.type==='aux-no-out')]);
                    if(comp.hasLeftAux) {
                        internalConnections.push([comp.connectors.find(c=>c.type==='aux-left-no-in'), comp.connectors.find(c=>c.type==='aux-left-no-out')]);
                    }
                } else {
                    internalConnections.push([comp.connectors.find(c=>c.type==='aux-nc-in'), comp.connectors.find(c=>c.type==='aux-nc-out')]);
                    if(comp.hasLeftAux) {
                        internalConnections.push([comp.connectors.find(c=>c.type==='aux-left-nc-in'), comp.connectors.find(c=>c.type==='aux-left-nc-out')]);
                    }
                }
            }

            if (comp.type === 'nfb' && comp.isOn) {
                 comp.connectors.filter(c => c.type === 'positive' || c.type === 'neutral').forEach(startConn => {
                     const endConn = comp.connectors.find(c => c.type === 'output' && c.pole === startConn.pole);
                     internalConnections.push([startConn, endConn]);
                 });
            }

            if (comp.type === 'th-ry') {
                // Main pass-through contacts are always connected
                for(let i=1; i<=3; i++) {
                     internalConnections.push([comp.connectors.find(c=>c.pole===`L${i}`), comp.connectors.find(c=>c.pole===`T${i}`)]);
                }
                if (comp.relayType === 'A') {
                    if (comp.isTripped) {
                        internalConnections.push([comp.connectors.find(c=>c.pole==='97'), comp.connectors.find(c=>c.pole==='98')]); // NO closes
                    } else {
                        internalConnections.push([comp.connectors.find(c=>c.pole==='95'), comp.connectors.find(c=>c.pole==='96')]); // NC closes
                    }
                } else { // Type B
                    if(comp.isTripped) {
                        internalConnections.push([comp.connectors.find(c=>c.pole==='95'), comp.connectors.find(c=>c.pole==='98')]); // COM -> NO
                    } else {
                        internalConnections.push([comp.connectors.find(c=>c.pole==='95'), comp.connectors.find(c=>c.pole==='96')]); // COM -> NC
                    }
                }
            }


            internalConnections.forEach(([connA, connB]) => {
                if(!connA || !connB) return;
                let otherConn = null;
                if(connA.id === currentConn.id) otherConn = connB;
                if(connB.id === currentConn.id) otherConn = connA;
                if(otherConn && !visitedConnectors.has(otherConn.id)) {
                    otherConn.potential = potential; visitedConnectors.add(otherConn.id); queue.push(otherConn);
                }
            });
        }
    });

    components.filter(c => c.type === 'fuse' && !c.isBlown).forEach(fuse => {
        const potA = fuse.connectors[0].potential;
        const potB = fuse.connectors[1].potential;
        if ((potA === 1 && potB === -1) || (potA === -1 && potB === 1)) {
            fuse.isBlown = true;
        }
    });
}

// --- EVENT HANDLERS ---
function handleToolClick(toolElement) {
    placementPreview = null;
    wiringState = { start: null, end: null };
    wiringPathPoints = [];
    selectedComponent = null;
    const clickedToolType = toolElement.dataset.type;

    if (toolElement.classList.contains('active')) {
        toolElement.classList.remove('active');
        activeToolType = null;
        canvas.style.cursor = 'default';
    } else {
        document.querySelectorAll('#toolbar .tool-item.active').forEach(el => el.classList.remove('active'));
        toolElement.classList.add('active');
        activeToolType = clickedToolType;

        canvas.style.cursor = 'default';
        if (activeToolType === 'move') canvas.style.cursor = 'grab';
        if (activeToolType === 'wire') canvas.style.cursor = 'crosshair';
        if (activeToolType === 'delete') canvas.style.cursor = 'not-allowed';
    }
    draw();
}

function handleCanvasInteraction(x, y, e = null) {
    if (selectedWire && wireEditorUI.colorRect) {
        const cr = wireEditorUI.colorRect; const tr = wireEditorUI.thickRect; const dr = wireEditorUI.deleteRect;
        if (x >= cr.x && x <= cr.x + cr.width && y >= cr.y && y <= cr.y + cr.height) { selectedWire.color = WIRE_COLORS[selectedWire.color] || '#f6e05e'; draw(); return; }
        if (x >= tr.x && x <= tr.x + tr.width && y >= tr.y && y <= tr.y + tr.height) { selectedWire.thickness = WIRE_THICKNESS[selectedWire.thickness] || 3; draw(); return; }
        if (x >= dr.x && x <= dr.x + dr.width && y >= dr.y && y <= dr.y + dr.height) { wires = wires.filter(w => w.id !== selectedWire.id); selectedWire = null; draw(); return; }
    }

    const isComponentTool = ['nfb', 'bulb', 'switch', 'contactor', 'fuse', 'th-ry', 'motor'].includes(activeToolType);
    if (isComponentTool) {
        selectedComponent = null;
        const clickedOnComponent = components.some(c => c.isUnderMouse(x, y));
        const sX = snapToGrid(x); const sY = snapToGrid(y);

        if (placementPreview) {
            const tempPreviewComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
            const mouseOnPreview = (x >= tempPreviewComp.x && x <= tempPreviewComp.x + tempPreviewComp.width && y >= tempPreviewComp.y && y <= tempPreviewComp.y + tempPreviewComp.height);

            if (mouseOnPreview) {
                const rect = { x: placementPreview.x, y: placementPreview.y, width: tempPreviewComp.width, height: tempPreviewComp.height };
                if (!checkCollision(rect)) {
                    const newComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
                    if (newComp) components.push(newComp);
                }
                placementPreview = null;
            } else {
                placementPreview = null;
            }
        } else if (!clickedOnComponent) {
            const tempComp = createTempComponent(activeToolType, sX, sY);
            placementPreview = { type: activeToolType, x: tempComp.x, y: tempComp.y };
        }
    } else {
        const clickedComponent = components.find(c => c.isUnderMouse(x, y));
        const clickedConnector = components.flatMap(c => c.connectors).find(c => Math.hypot(c.x - x, c.y - y) < GRID_SIZE / 2);

        if (activeToolType === null && clickedConnector) {
            const isConnected = wires.some(w => w.start.id === clickedConnector.id || w.end.id === clickedConnector.id);
            if (!isConnected) {
                handleToolClick(document.getElementById('wire-tool'));
                wiringState.start = clickedConnector;
                wiringPathPoints.push({ x: clickedConnector.x, y: clickedConnector.y });
                draw();
                return;
            }
        }

        if (activeToolType === 'delete') {
            if (clickedComponent) {
                wires = wires.filter(w => w.start.parent.id !== clickedComponent.id && w.end.parent.id !== clickedComponent.id);
                components = components.filter(c => c.id !== clickedComponent.id);
            } else {
                const wireToDelete = wires.find(w => { if (!w.path || w.path.length < 2) return false; for (let i = 0; i < w.path.length - 1; i++) { if (pDistance(x, y, w.path[i].x, w.path[i].y, w.path[i+1].x, w.path[i+1].y) < 5) return true; } return false; });
                if (wireToDelete) wires = wires.filter(w => w.id !== wireToDelete.id);
            }
            selectedWire = null;
            selectedComponent = null;
        } else if (activeToolType === 'wire') {
            selectedComponent = null;
            if (clickedConnector) {
                if (!wiringState.start) {
                    wiringState.start = clickedConnector; wiringPathPoints.push({ x: clickedConnector.x, y: clickedConnector.y });
                } else if (wiringState.start.id !== clickedConnector.id) {
                    wiringState.end = { x: clickedConnector.x, y: clickedConnector.y };
                    wires.push(new Wire(wiringState.start, clickedConnector, getPreviewPath()));
                    wiringState = { start: null, end: null }; wiringPathPoints = [];
                }
            } else if (wiringState.start) {
                wiringState.end = { x, y };
                wiringPathPoints = getPreviewPath();
                wiringState.end = null;
            }
            selectedWire = null;
        } else {
            let somethingWasClicked = false;
            const wireToSelect = wires.find(w => { if (!w.path || w.path.length < 2) return false; for (let i = 0; i < w.path.length - 1; i++) { if (pDistance(x, y, w.path[i].x, w.path[i].y, w.path[i+1].x, w.path[i+1].y) < 6) return true; } return false; });

            if (wireToSelect) {
                selectedWire = wireToSelect;
                selectedComponent = null;
                somethingWasClicked = true;
            } else if (clickedComponent) {
                selectedComponent = clickedComponent;
                selectedWire = null;
                if (clickedComponent.type === 'switch' && clickedComponent.switchType.startsWith('pushbutton')) return;

                if (typeof clickedComponent.handleInteraction === 'function') {
                    clickedComponent.handleInteraction(x, y);
                }

                somethingWasClicked = true;
            }

            if (!somethingWasClicked) {
                selectedWire = null;
                selectedComponent = null;
            }
        }
    }
    draw();
}


canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        canvas.style.cursor = 'grabbing';
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        view.tx += dx;
        view.ty += dy;
        panStart = { x: e.clientX, y: e.clientY };
        draw();
        return;
    }

    const pos = getCanvasMousePos(e);

    if (longPressTimer) {
        const dist = Math.hypot(pos.x - longPressStartPos.x, pos.y - longPressStartPos.y);
        if (dist > 5) { clearTimeout(longPressTimer); longPressTimer = null; }
    }

    if (isDraggingPreview && placementPreview) {
        placementPreview.x = snapToGrid(pos.x - dragOffset.x);
        placementPreview.y = snapToGrid(pos.y - dragOffset.y);
        justDragged = true;
    } else if ((activeToolType === 'move' || isLongPressDrag) && draggedComponent) {
        const newX = snapToGrid(pos.x - dragOffset.x);
        const newY = snapToGrid(pos.y - dragOffset.y);
        draggedComponent.updatePosition(newX, newY);
        justDragged = true;
    } else if (activeToolType === 'wire' && wiringState.start) {
        wiringState.end = pos;
    } else if (draggedGhost) {
        draggedGhost.x = pos.x - dragOffset.x;
        draggedGhost.y = pos.y - dragOffset.y;
        const tempRect = { x: snapToGrid(draggedGhost.x), y: snapToGrid(draggedGhost.y), width: draggedGhost.width, height: draggedGhost.height };
        draggedGhost.isColliding = checkCollision(tempRect);
    }
    draw();
});

canvas.addEventListener('click', (e) => {
    if (justDragged) return;
    const { x, y } = getCanvasMousePos(e);
    handleCanvasInteraction(x,y, e);
});

canvas.addEventListener('dblclick', (e) => {
    const { x, y } = getCanvasMousePos(e);
    handleCanvasDoubleClick(x,y);
});

function handleCanvasDoubleClick(x,y) {
    const clickedComponent = components.find(c => c.isUnderMouse(x, y));
    if (clickedComponent) {
        selectedComponentForEdit = clickedComponent;
        if (clickedComponent.type === 'nfb') { poleModalTitle.textContent = `編輯 NFB 極性`; openPoleModal(['1P', '2P', '3P', '4P']); }
        else if (clickedComponent.type === 'switch') { switchModal.classList.remove('hidden'); }
        else if (clickedComponent.type === 'bulb') { clickedComponent.cycleColor(); draw(); }
        else if (clickedComponent.type === 'th-ry') { thRyModal.classList.remove('hidden'); }
        else if (clickedComponent.type === 'motor') { motorModal.classList.remove('hidden'); }
        else if (clickedComponent.type === 'fuse' && clickedComponent.isBlown) {
            clickedComponent.isBlown = false;
            draw();
        }
        else if (clickedComponent.type === 'contactor') {
            contactorNameInput.value = clickedComponent.name;
            if (clickedComponent.hasLeftAux) {
                addAuxContactBtn.style.display = 'none';
                removeAuxContactBtn.style.display = 'block';
            } else {
                addAuxContactBtn.style.display = 'block';
                removeAuxContactBtn.style.display = 'none';
            }
            contactorEditModal.classList.remove('hidden');
        }
    }
}

function openPoleModal(options) {
    poleOptionsContainer.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.dataset.poles = opt;
        btn.className = 'pole-btn flex-1 bg-blue-600 hover:bg-blue-700 p-2 rounded';
        btn.textContent = opt;
        poleOptionsContainer.appendChild(btn);
    });
    poleModal.classList.remove('hidden');
}

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // Middle mouse button for panning
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }

    const pos = getCanvasMousePos(e);
    justDragged = false;

    const comp = components.find(c => c.isUnderMouse(pos.x, pos.y));
    const tempPreviewComp = placementPreview ? createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y) : null;
    const mouseOnPreview = tempPreviewComp && (pos.x >= tempPreviewComp.x && pos.x <= tempPreviewComp.x + tempPreviewComp.width && pos.y >= tempPreviewComp.y && pos.y <= tempPreviewComp.y + tempPreviewComp.height);
    const isComponentTool = ['nfb', 'bulb', 'switch', 'contactor', 'fuse', 'th-ry', 'motor'].includes(activeToolType);

    if (activeToolType === 'move' && comp) {
         canvas.style.cursor = 'grabbing';
         draggedComponent = comp;
         draggedComponent.originalX = comp.x; draggedComponent.originalY = comp.y;
         dragOffset = { x: pos.x - draggedComponent.x, y: pos.y - draggedComponent.y };
    } else if (activeToolType === null || isComponentTool) {
         if (mouseOnPreview) {
            longPressTimer = setTimeout(() => {
                isDraggingPreview = true;
                dragOffset = { x: pos.x - placementPreview.x, y: pos.y - placementPreview.y };
                longPressTimer = null;
            }, 500);
        } else if (comp) {
            potentialDragComponent = comp;
            longPressStartPos = pos;
            longPressTimer = setTimeout(() => {
                isLongPressDrag = true;
                draggedComponent = potentialDragComponent;
                draggedComponent.originalX = comp.x; draggedComponent.originalY = comp.y;
                dragOffset = { x: longPressStartPos.x - draggedComponent.x, y: longPressStartPos.y - draggedComponent.y };
                selectedWire = null;
                selectedComponent = null;
                canvas.style.cursor = 'grabbing';
                draw();
                longPressTimer = null;
            }, 500);

            if (comp.type === 'switch' && comp.switchType.startsWith('pushbutton')) {
                isPressingButton = true; comp.press(); draw();
            }
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'default';
    }
    clearTimeout(longPressTimer); longPressTimer = null;

    if (isDraggingPreview){
        const tempComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
        const rect = { x: placementPreview.x, y: placementPreview.y, width: tempComp.width, height: tempComp.height };
        if(checkCollision(rect)){
           placementPreview = null; // Cancel if dragged to colliding spot
        }
    }
    isDraggingPreview = false;

    if (activeToolType === 'move' || isLongPressDrag) canvas.style.cursor = (activeToolType === 'move' ? 'grab' : 'default');

    if (draggedComponent) {
        const rect = { x: draggedComponent.x, y: draggedComponent.y, width: draggedComponent.width, height: draggedComponent.height };
        if (checkCollision(rect, draggedComponent.id)) {
            draggedComponent.updatePosition(draggedComponent.originalX, draggedComponent.originalY);
        }
    }

    if (isLongPressDrag) isLongPressDrag = false;
    draggedComponent = null;

    if (isPressingButton) {
        isPressingButton = false;
        components.forEach(c => c.release && c.release());
    }

    draw();
    setTimeout(() => { justDragged = false; }, 10);
});

wireColorPicker.addEventListener('click', () => {
    wireColorIndex = (wireColorIndex + 1) % WIRE_DEFAULT_COLORS.length;
    defaultWireColor = WIRE_DEFAULT_COLORS[wireColorIndex];
    wireColorPicker.style.backgroundColor = defaultWireColor;
});

wireThicknessPicker.addEventListener('click', () => {
    defaultWireThickness = defaultWireThickness === 3 ? 6 : 3;
    wireThicknessPicker.textContent = defaultWireThickness === 3 ? '細' : '粗';
});

// --- Toolbar Drag & Drop ---
toolbar.addEventListener('dragstart', (e) => {
    const toolItem = e.target.closest('.tool-item');
    if(toolItem && toolItem.draggable){
         draggedToolType = toolItem.dataset.type;
         const tempComp = createTempComponent(draggedToolType, 0, 0);
         dragOffset.x = tempComp.width / 2;
         dragOffset.y = tempComp.height / 2;
    }
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    if(!draggedToolType) return;
    const pos = getCanvasMousePos(e);
    const sX = snapToGrid(pos.x - dragOffset.x);
    const sY = snapToGrid(pos.y - dragOffset.y);
    const tempComp = createTempComponent(draggedToolType, sX, sY);

    draggedGhost = {
        type: draggedToolType,
        x: sX, y: sY,
        width: tempComp.width, height: tempComp.height,
        isColliding: checkCollision({ x: sX, y: sY, width: tempComp.width, height: tempComp.height })
    };
    draw();
});

canvas.addEventListener('dragleave', (e) => { draggedGhost = null; draw(); });
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    if(draggedGhost && !draggedGhost.isColliding) {
        const newComp = createTempComponent(draggedGhost.type, draggedGhost.x, draggedGhost.y);
        if(newComp) components.push(newComp);
        if (activeToolType === 'delete') {
            handleToolClick(document.getElementById('delete-tool'));
        }
    }
    draggedToolType = null;
    draggedGhost = null;
    draw();
});

// --- KEYBOARD HANDLERS ---
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (placementPreview) { placementPreview = null; }
        else if(activeToolType === 'wire' && wiringState.start) { wiringState = { start: null, end: null }; wiringPathPoints = []; }
        else if (selectedWire) { selectedWire = null; }
        else if (selectedComponent) { selectedComponent = null; }
        else if (activeToolType) {
            document.querySelector(`.tool-item[data-type="${activeToolType}"]`)?.classList.remove('active');
            activeToolType = null;
            canvas.style.cursor = 'default';
        }
        draw();
    } else if (activeToolType === 'wire' && e.key === 'Backspace' && wiringPathPoints.length > 1) {
        wiringPathPoints.pop();
        draw();
    } else if (e.key === 'Delete' && selectedComponent) {
        if (selectedComponent.type === 'contactor' || selectedComponent.type === 'motor') updateComponentCounter(selectedComponent.type);
        wires = wires.filter(w => w.start.parent.id !== selectedComponent.id && w.end.parent.id !== selectedComponent.id);
        components = components.filter(c => c.id !== selectedComponent.id);
        selectedComponent = null;
        draw();
    } else if (e.key === 'Delete' && selectedWire) {
        wires = wires.filter(w => w.id !== selectedWire.id);
        selectedWire = null;
        draw();
    }
});

// --- MODAL LOGIC ---
closeContactorEditModalBtn.addEventListener('click', () => {
    if (selectedComponentForEdit && selectedComponentForEdit.type === 'contactor') {
        selectedComponentForEdit.name = contactorNameInput.value;
    }
    contactorEditModal.classList.add('hidden');
    selectedComponentForEdit = null;
    draw();
});

poleOptionsContainer.addEventListener('click', (e) => { if (e.target.classList.contains('pole-btn')) { const poles = e.target.dataset.poles; if (selectedComponentForEdit) { selectedComponentForEdit.setPoles(poles); draw(); } poleModal.classList.add('hidden'); selectedComponentForEdit = null; } });
closePoleModalBtn.addEventListener('click', () => { poleModal.classList.add('hidden'); selectedComponentForEdit = null; });
switchModal.addEventListener('click', (e) => { if (e.target.classList.contains('switch-type-btn')) { const type = e.target.dataset.switchType; if (selectedComponentForEdit && selectedComponentForEdit.type === 'switch') { selectedComponentForEdit.setSwitchType(type); draw(); } switchModal.classList.add('hidden'); selectedComponentForEdit = null; } });
closeSwitchModalBtn.addEventListener('click', () => { switchModal.classList.add('hidden'); selectedComponentForEdit = null; });

thRyModal.addEventListener('click', (e) => { if (e.target.classList.contains('th-ry-type-btn')) { const type = e.target.dataset.thRyType; if (selectedComponentForEdit && selectedComponentForEdit.type === 'th-ry') { selectedComponentForEdit.setRelayType(type); draw(); } thRyModal.classList.add('hidden'); selectedComponentForEdit = null; } });
closeThRyModalBtn.addEventListener('click', () => { thRyModal.classList.add('hidden'); selectedComponentForEdit = null; });

motorModal.addEventListener('click', (e) => { if (e.target.classList.contains('motor-type-btn')) { const type = e.target.dataset.motorType; if (selectedComponentForEdit && selectedComponentForEdit.type === 'motor') { selectedComponentForEdit.setMotorType(type); draw(); } motorModal.classList.add('hidden'); selectedComponentForEdit = null; } });
closeMotorModalBtn.addEventListener('click', () => { motorModal.classList.add('hidden'); selectedComponentForEdit = null; });


// --- SAVE/LOAD LOGIC ---
function getNextContactorNumber() {
    const existing = components.filter(c => c.type === 'contactor');
    let maxNum = 0;
    existing.forEach(mc => {
        if (mc.name && mc.name.startsWith('MC')) {
            const num = parseInt(mc.name.substring(2));
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    return maxNum + 1;
}

function getNextMotorNumber() {
    const existing = components.filter(c => c.type === 'motor');
    let maxNum = 0;
    existing.forEach(m => {
        if (m.name && m.name.startsWith('M')) {
            const num = parseInt(m.name.substring(1));
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    return maxNum + 1;
}


function saveLayout() {
    const layout = {
        components: components.map(c => {
            const data = { id: c.id, type: c.type, x: c.x, y: c.y };
            if (c.poleType) data.poleType = c.poleType;
            if (c.switchType) data.switchType = c.switchType;
            if (c.relayType) data.relayType = c.relayType;
            if (c.motorType) data.motorType = c.motorType;
            if (c.colorIndex !== undefined) data.colorIndex = c.colorIndex;
            if (c.isOn !== undefined) data.isOn = c.isOn;
            if (c.isBlown !== undefined) data.isBlown = c.isBlown;
            if (c.isTripped !== undefined) data.isTripped = c.isTripped;
            if (c.state) data.state = c.state;
            if (c.position) data.position = c.position;
            if (c.hasLeftAux !== undefined) data.hasLeftAux = c.hasLeftAux;
            if (c.name) data.name = c.name;
            return data;
        }),
        wires: wires.map(w => ({
            id: w.id,
            startConnectorId: w.start.id,
            endConnectorId: w.end.id,
            path: w.path,
            color: w.color,
            thickness: w.thickness
        })),
        nextId: nextId,
    };

    const dataStr = JSON.stringify(layout, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circuit-layout.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadLayout(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const layout = JSON.parse(e.target.result);
            reconstructLayout(layout);
        } catch (error) {
            console.error("Error parsing layout file:", error);
            alert("讀取檔案失敗，請確認檔案格式是否正確。");
        }
    };
    reader.readAsText(file);
    fileInput.value = ''; // Reset input
}

function reconstructLayout(layout) {
    components = [];
    wires = [];
    nextId = 0;

    layout.components.forEach(data => {
        let comp;
        // Temporarily prevent auto-incrementing name during reconstruction
        const originalContactorConstructor = MagneticContactor;
        const originalMotorConstructor = Motor;

        if (data.type === 'contactor') {
            MagneticContactor = function(x,y) { // Override
                Component.call(this, x, y, 'contactor');
                this.name = data.name; this.coilEnergized = false; this.hasLeftAux = data.hasLeftAux || false;
                this._updateDimensions(); this._rebuildConnectors();
            }
            MagneticContactor.prototype = Object.create(Component.prototype);
            Object.assign(MagneticContactor.prototype, originalContactorConstructor.prototype);
        }
         if (data.type === 'motor') {
            Motor = function(x,y) { // Override
                Component.call(this, x, y, 'motor');
                this.name = data.name; this.motorType = data.motorType || '3-phase-6'; this.isPowered = false; this.animationFrame = 0;
                this._updateDimensions(); this._rebuildConnectors();
            }
            Motor.prototype = Object.create(Component.prototype);
            Object.assign(Motor.prototype, originalMotorConstructor.prototype);
        }

        comp = createTempComponent(data.type, data.x, data.y);

        if (data.type === 'contactor') MagneticContactor = originalContactorConstructor;
        if (data.type === 'motor') Motor = originalMotorConstructor;


        if (comp) {
            Object.assign(comp, data);
            comp._updateDimensions();
            comp._rebuildConnectors();
            components.push(comp);
        }
    });

    const allConnectors = new Map();
    components.forEach(c => c.connectors.forEach(conn => allConnectors.set(conn.id, conn)));

    layout.wires.forEach(data => {
        const start = allConnectors.get(data.startConnectorId);
        const end = allConnectors.get(data.endConnectorId);
        if (start && end) {
            const wire = new Wire(start, end, data.path);
            wire.id = data.id;
            wire.color = data.color;
            wire.thickness = data.thickness;
            wires.push(wire);
        }
    });

    nextId = layout.nextId || 0;
    draw();
}


// --- INITIALIZATION ---
window.addEventListener('resize', resizeCanvas);
document.querySelectorAll('#toolbar .tool-item[data-type]').forEach(el => {
   el.addEventListener('click', (e) => handleToolClick(e.currentTarget));
});

document.getElementById('bulb-tool-item').addEventListener('dblclick', () => {
    nextBulbColorIndex = (nextBulbColorIndex + 1) % bulbColors.length;
    const color = bulbColors[nextBulbColorIndex].color;
    document.getElementById('bulb-tool-item').style.boxShadow = `0 0 10px 3px ${color}`;
    setTimeout(() => { document.getElementById('bulb-tool-item').style.boxShadow = ''; }, 300);
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mousePointX = (mouseX - view.tx) / view.scale;
    const mousePointY = (mouseY - view.ty) / view.scale;

    view.scale *= zoom;
    view.scale = Math.max(0.25, Math.min(4, view.scale));

    view.tx = mouseX - mousePointX * view.scale;
    view.ty = mouseY - mousePointY * view.scale;

    draw();
});

// --- TOUCH EVENTS ---
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const pos = getCanvasMousePos(touch);
        justDragged = false;
        potentialDragComponent = components.find(c => c.isUnderMouse(pos.x, pos.y)) || null;

        longPressStartPos = pos;
        longPressTimer = setTimeout(() => {
            if(potentialDragComponent) {
                isLongPressDrag = true;
                draggedComponent = potentialDragComponent;
                draggedComponent.originalX = draggedComponent.x;
                draggedComponent.originalY = draggedComponent.y;
                dragOffset = { x: longPressStartPos.x - draggedComponent.x, y: longPressStartPos.y - draggedComponent.y };
                selectedWire = null;
                selectedComponent = null;
            } else if(activeToolType === null) {
                isPanning = true;
                panStart = { x: touch.clientX, y: touch.clientY };
            }
            canvas.style.cursor = 'grabbing';
            draw();
            longPressTimer = null;
        }, 500);

        if (potentialDragComponent && potentialDragComponent.type === 'switch' && potentialDragComponent.switchType.startsWith('pushbutton')) {
            isPressingButton = true;
            potentialDragComponent.press();
            draw();
        }
    } else if (e.touches.length === 2) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        pinchState.active = true;
        pinchState.initialDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (isPanning) {
        const touch = e.touches[0];
        const dx = touch.clientX - panStart.x;
        const dy = touch.clientY - panStart.y;
        view.tx += dx;
        view.ty += dy;
        panStart = { x: touch.clientX, y: touch.clientY };
        draw();
        return;
    }

    if (e.touches.length === 1 && !pinchState.active) {
        const touch = e.touches[0];
        const pos = getCanvasMousePos(touch);

        if (longPressTimer) {
            const dist = Math.hypot(pos.x - longPressStartPos.x, pos.y - longPressStartPos.y);
            if (dist > 10) { clearTimeout(longPressTimer); longPressTimer = null; }
        }

        if (isLongPressDrag && draggedComponent) {
            const newX = snapToGrid(pos.x - dragOffset.x);
            const newY = snapToGrid(pos.y - dragOffset.y);
            draggedComponent.updatePosition(newX, newY);
            justDragged = true;
        } else if (activeToolType === 'wire' && wiringState.start) {
            wiringState.end = pos;
        }
        draw();

    } else if (e.touches.length === 2 && pinchState.active) {
        clearTimeout(longPressTimer);
        longPressTimer = null;

        const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const scaleFactor = currentDist / pinchState.initialDist;

        const rect = canvas.getBoundingClientRect();
        const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

        const mousePointX = (midX - view.tx) / view.scale;
        const mousePointY = (midY - view.ty) / view.scale;

        view.scale *= scaleFactor;
        view.scale = Math.max(0.25, Math.min(4, view.scale));

        view.tx = midX - mousePointX * view.scale;
        view.ty = midY - mousePointY * view.scale;

        pinchState.initialDist = currentDist;
        draw();
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();

    if (!isLongPressDrag && !justDragged && e.changedTouches.length === 1 && !pinchState.active && !isPanning) {
         const touch = e.changedTouches[0];
         const { x, y } = getCanvasMousePos(touch);

        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        const dist = lastTapPos ? Math.hypot(x - lastTapPos.x, y - lastTapPos.y) : Infinity;

        if (tapLength < 300 && tapLength > 0 && dist < 20) {
             handleCanvasDoubleClick(x, y);
             lastTap = 0; // Reset tap
             lastTapPos = null;
        } else {
             handleCanvasInteraction(x, y);
             lastTap = currentTime;
             lastTapPos = {x, y};
        }
    }

    clearTimeout(longPressTimer);
    longPressTimer = null;

    if (isLongPressDrag) {
         if (draggedComponent) {
            const rect = { x: draggedComponent.x, y: draggedComponent.y, width: draggedComponent.width, height: draggedComponent.height };
            if (checkCollision(rect, draggedComponent.id)) {
                draggedComponent.updatePosition(draggedComponent.originalX, draggedComponent.originalY);
            }
        }
        isLongPressDrag = false;
        draggedComponent = null;
    }

    if (isPressingButton) {
        isPressingButton = false;
        components.forEach(c => c.release && c.release());
    }

    if (isPanning) {
        isPanning = false;
    }

    if (e.touches.length < 2) {
         pinchState.active = false;
    }

    draw();
    setTimeout(() => { justDragged = false; }, 50); // a small delay to prevent click after drag
}, { passive: false });


saveButton.addEventListener('click', saveLayout);
loadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', loadLayout);

// Start animation loop for things like motors
function animate() {
    let needsRedraw = false;
    components.forEach(c => {
        if (c.type === 'motor' && c.isPowered) {
            needsRedraw = true;
        }
    });
    if(needsRedraw) draw();
    requestAnimationFrame(animate);
}

resizeCanvas();
animate();
wireColorPicker.style.backgroundColor = defaultWireColor;