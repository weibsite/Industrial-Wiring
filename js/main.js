// --- SETUP ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const toolbar = document.getElementById('toolbar');
const canvasContainer = document.getElementById('canvas-container');
const wireColorPicker = document.getElementById('wire-color-picker');
const wireThicknessPicker = document.getElementById('wire-thickness-picker');

const genericEditModal = document.getElementById('generic-edit-modal');
const modalTitle = document.getElementById('generic-modal-title');
const editOptionsContainer = document.getElementById('edit-options-container');
const editNumericInputsContainer = document.getElementById('edit-numeric-inputs-container');
const saveModalBtn = document.getElementById('save-generic-modal-btn');

const infoBox = document.getElementById('info-box');
const infoBoxTitle = document.getElementById('info-box-title');
const infoBoxContent = document.getElementById('info-box-content');
const infoBoxClose = document.getElementById('info-box-close');

const imageViewerModal = document.getElementById('image-viewer-modal');
const enlargedImg = document.getElementById('enlarged-img');
const imageViewerClose = document.getElementById('image-viewer-close');

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
let placementPreview = null;
let isDraggingPreview = false;
let wiringState = { start: null, end: null };
let wiringPathPoints = [];
let selectedComponent = null;
let selectedComponentForEdit = null;
let draggedComponent = null;
let isPressingButton = false;
let dragOffset = { x: 0, y: 0 };
let longPressTimer = null;
let isLongPressDrag = false;
let potentialDragComponent = null;
let longPressStartPos = { x: 0, y: 0 };
let justDragged = false;

let view = { scale: 1.0, tx: 0, ty: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
let pinchState = { active: false, initialDist: 0 };

let lastTap = 0;
let lastTapPos = null;

let renameInput = null;
let componentBeingRenamed = null;

let interactingComponent = null; 
let infoBoxTarget = null;
let componentDescriptionMap = new Map();

// --- Wire Settings ---
let defaultWireColor = '#f6e05e';
let defaultWireThickness = 3;
const WIRE_DEFAULT_COLORS = ['#f6e05e', '#e53e3e', '#4299e1', '#48bb78', '#1a202c'];
let wireColorIndex = 0;

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
const snapToGrid = (val) => Math.round(val / (GRID_SIZE / 2)) * (GRID_SIZE / 2);
const getCanvasMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
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
            return true;
        }
    }
    return false;
}

function createTempComponent(type, x, y){
    switch (type) {
        case 'power': return new PowerSource(x, y);
        case 'nfb': return new NFB(x, y);
        case 'bulb': return new Bulb(x, y, nextBulbColorIndex);
        case 'switch': return new Switch(x, y);
        case 'contactor': return new MagneticContactor(x, y);
        case 'fuse': return new FuseHolder(x, y);
        case 'th-ry': return new ThermalOverloadRelay(x,y);
        case 'motor': return new Motor(x,y);
        case 'terminalBlock': return new TerminalBlock(x,y);
        case 'relay': return new Relay(x, y);
        case 'resistor': return new Resistor(x, y);
        case 'ammeter': return new Ammeter(x, y);
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
    const fillColor = c.potential !== 0 ? (c.potential === 1 ? '#f6e05e' : '#4299e1') : '#2d3748';
    const strokeColor = c.potential !== 0 ? (c.potential === 1 ? '#f6e05e' : '#4299e1') : '#a0aec0';

    ctx.lineWidth = 1.5 / view.scale;
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

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
    ctx.lineWidth = 0.5 / view.scale;
    const left = -view.tx / view.scale;
    const top = -view.ty / view.scale;
    const right = (canvas.width - view.tx) / view.scale;
    const bottom = (canvas.height - view.ty) / view.scale;
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
    ctx.translate(view.tx, view.ty);
    ctx.scale(view.scale, view.scale);

    drawGrid();
    
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
        ctx.strokeStyle = '#a0aec0';
        ctx.lineWidth = 2 / view.scale;
        ctx.setLineDash([6 / view.scale, 3 / view.scale]);
        ctx.strokeRect(selectedComponent.x - 4, selectedComponent.y - 4, selectedComponent.width + 8, selectedComponent.height + 8);
        ctx.setLineDash([]);
    }

    if (infoBoxTarget) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3 / view.scale;
        ctx.setLineDash([8 / view.scale, 4 / view.scale]);
        ctx.strokeRect(infoBoxTarget.x - 6, infoBoxTarget.y - 6, infoBoxTarget.width + 12, infoBoxTarget.height + 12);
        ctx.setLineDash([]);

        const screenX = (infoBoxTarget.x + infoBoxTarget.width) * view.scale + view.tx + 10;
        const screenY = infoBoxTarget.y * view.scale + view.ty;
        infoBox.style.left = `${screenX}px`;
        infoBox.style.top = `${screenY}px`;
    }

    components.forEach(c => c.draw(ctx));

    const previewComponent = placementPreview || draggedGhost;
    if (previewComponent) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        const tempComp = createTempComponent(previewComponent.type, previewComponent.x, previewComponent.y);
        if (tempComp) {
            if(tempComp.type === 'terminalBlock' || tempComp.type === 'relay') tempComp.setRelayType('2C');
            if (previewComponent.isColliding) {
                ctx.strokeStyle = '#ef4444';
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
    ctx.restore();
}

// --- SIMULATION LOGIC ---
function runSimulation() {
    // Reset all potentials and currents
    components.forEach(c => {
        c.connectors.forEach(conn => { conn.potential = 0; });
        if (c.type === 'ammeter') c.measuredCurrent = 0;
    });
    wires.forEach(w => { w.potential = 0; w.current = 0; w.isOvercurrent = false; });

    const powerSources = components.filter(c => c.type === 'power');
    if (powerSources.length === 0) return;

    // 1. Propagate potentials from all power sources
    let queue = [];
    powerSources.forEach(ps => {
        ps.connectors.forEach(c => {
            if (c.type === 'neutral') c.potential = -1;
            else if (c.type === 'positive' || c.type === 'positive_alt') c.potential = 1;
            queue.push(c);
        });
    });

    let visitedConnectors = new Set(queue.map(c => c.id));
    while (queue.length > 0) {
        const currentConn = queue.shift();
        
        // Propagate through wires
        wires.forEach(w => {
            let otherConn = null;
            if (w.start.id === currentConn.id) otherConn = w.end;
            if (w.end.id === currentConn.id) otherConn = w.start;
            
            if (otherConn && !visitedConnectors.has(otherConn.id)) {
                w.potential = currentConn.potential;
                otherConn.potential = currentConn.potential;
                visitedConnectors.add(otherConn.id);
                queue.push(otherConn);
            }
        });
        
        // Propagate through internal component connections
        const comp = currentConn.parent;
        const internalConnections = comp.getInternalConnections ? comp.getInternalConnections() : [];
        
        internalConnections.forEach(([connA, connB]) => {
            if(!connA || !connB) return;
            if (connA.potential !== 0 && connB.potential === 0 && !visitedConnectors.has(connB.id)) {
                connB.potential = connA.potential;
                visitedConnectors.add(connB.id);
                queue.push(connB);
            } else if (connB.potential !== 0 && connA.potential === 0 && !visitedConnectors.has(connA.id)) {
                connA.potential = connB.potential;
                visitedConnectors.add(connA.id);
                queue.push(connA);
            }
        });
    }

    // 2. Find circuits and calculate current for each power source
    powerSources.forEach(ps => {
        const positiveTerminals = ps.connectors.filter(c => c.potential === 1);
        
        positiveTerminals.forEach(startNode => {
            const circuit = findCircuit(startNode, ps);
            if (circuit) {
                const { path, resistance, loads } = circuit;
                const totalResistance = Math.max(0.01, resistance);
                const current = ps.voltage / totalResistance;

                let minAmperageLimit = Infinity;
                path.forEach(item => {
                    if (item.component && item.component.amperageLimit != null) {
                        minAmperageLimit = Math.min(minAmperageLimit, item.component.amperageLimit);
                    }
                });

                // Apply current and check for overcurrent
                path.forEach(item => {
                    if (item.wire) {
                        item.wire.current = current;
                        item.wire.isOvercurrent = current > minAmperageLimit;
                    }
                    if (item.component) {
                        item.component.current = current;
                        if (item.component.type === 'ammeter') {
                            item.component.measuredCurrent = current;
                        }
                    }
                });
                
                // Trip breakers/blow fuses if overcurrent
                if (current > minAmperageLimit) {
                    loads.forEach(load => {
                        if (load.amperageLimit <= minAmperageLimit) {
                            if (load.type === 'nfb') load.isOn = false;
                            if (load.type === 'fuse') load.isBlown = true;
                            if (load.type === 'th-ry') load.isTripped = true;
                        }
                    });
                }
            }
        });
    });
}

function findCircuit(startNode, powerSource) {
    let queue = [[startNode, [{ component: startNode.parent }]]];
    let visited = new Set([startNode.id]);
    
    while(queue.length > 0) {
        const [currentNode, path] = queue.shift();
        
        // Check if we reached a neutral terminal of the SAME power source
        if (currentNode.potential === -1 && currentNode.parent.id === powerSource.id) {
            let totalResistance = 0;
            let loads = new Set();
            path.forEach(item => {
                if (item.component && item.component.resistance) {
                    totalResistance += item.component.resistance;
                }
                if (item.component && item.component.amperageLimit != null) {
                    loads.add(item.component);
                }
            });
            return { path, resistance: totalResistance, loads: Array.from(loads) };
        }

        const neighbors = getNeighbors(currentNode);
        for (const neighbor of neighbors) {
            const { connector, through } = neighbor;
            if (!visited.has(connector.id)) {
                visited.add(connector.id);
                const newPath = [...path];
                if (through.type === 'wire') { newPath.push({ wire: through }); }
                if (through.type !== 'power') { // Don't add the power source itself as a path component
                    newPath.push({ component: connector.parent });
                }
                queue.push([connector, newPath]);
            }
        }
    }
    return null; // No complete circuit found
}

function getNeighbors(connector) {
    const neighbors = [];
    wires.forEach(wire => {
        if (wire.start.id === connector.id) neighbors.push({ connector: wire.end, through: wire });
        if (wire.end.id === connector.id) neighbors.push({ connector: wire.start, through: wire });
    });
    const component = connector.parent;
    if (component.getInternalConnections) {
        component.getInternalConnections().forEach(([c1, c2]) => {
            if (c1.id === connector.id) neighbors.push({ connector: c2, through: component });
            if (c2.id === connector.id) neighbors.push({ connector: c1, through: component });
        });
    }
    return neighbors;
}


// --- EVENT HANDLERS ---
function hideInfoBox() {
    infoBoxTarget = null;
    infoBox.classList.add('hidden');
    draw();
}

function showInfoBox(component) {
    infoBoxTarget = component;
    const key = component.getDescriptionKey();
    let descriptionText = componentDescriptionMap.get(key) || '此元件暫無說明，待補充';
    const title = component.name || component.displayName || component.type;
    
    infoBoxTitle.textContent = title;
    infoBoxContent.innerHTML = '';

    descriptionText = descriptionText.replace(/;/g, '<br>');
    const urlRegex = /(https?:\/\/[^\s]+?\.(?:jpg|jpeg|png|gif))/gi;
    const parts = descriptionText.split(urlRegex);

    parts.forEach(part => {
        if (!part) return;
        if (part.match(urlRegex)) {
            const img = document.createElement('img');
            img.src = part;
            img.className = 'info-thumbnail';
            img.title = '點擊放大圖片';
            img.onerror = () => { img.style.display = 'none'; };
            img.onclick = (e) => {
                e.stopPropagation();
                enlargedImg.src = img.src;
                imageViewerModal.classList.remove('hidden');
            };
            infoBoxContent.appendChild(img);
        } else {
            const textContainer = document.createElement('span');
            textContainer.innerHTML = part;
            infoBoxContent.appendChild(textContainer);
        }
    });
    infoBox.classList.remove('hidden');
    draw();
}

function handleToolClick(toolElement) {
    closeGenericEditModal();
    if (renameInput) exitRenameMode();

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
        if (activeToolType === 'query') canvas.style.cursor = 'help';
        if (activeToolType === 'rename') {
            canvas.style.cursor = 'text';
            if (selectedComponent) {
                enterRenameMode(selectedComponent);
            }
       }
    }
    draw();
}

function addComponentToCanvas(newComp) {
    switch (newComp.type) {
        case 'contactor':
        case 'motor':
        case 'terminalBlock':
        case 'th-ry':
        case 'nfb':
        case 'fuse':
        case 'resistor':
        case 'ammeter':
        case 'power':
            let prefixMap = { 'contactor': 'MC', 'motor': 'M', 'terminalBlock': 'TB', 'th-ry': 'TH', 'nfb': 'NFB', 'fuse': 'F', 'resistor': 'R', 'ammeter': 'A', 'power': 'PS'};
            newComp.name = prefixMap[newComp.type] + getNextNumberForType(newComp.type);
            break;
        case 'switch':
            newComp.name = 'PB' + getNextNumberForType('pushbutton');
            break;
        case 'bulb':
            newComp.displayName = 'PL' + getNextNumberForType('bulb');
            break;
        case 'relay':
            {
                let num, name;
                if (['2C', '3C', '4C'].includes(newComp.relayType)) {
                    num = getNextNumberForType('relay_pr');
                    name = `PR${num}`;
                } else if (newComp.relayType === 'ON-delay') {
                    num = getNextNumberForType('relay_tr');
                    name = `TR${num}`;
                } else if (newComp.relayType.startsWith('Y-delta')) {
                    num = getNextNumberForType('relay_tr_delta');
                    name = `TR${num}-Δ`;
                }
                newComp.name = name;
            }
            break;
    }
    applyDescriptionToComponent(newComp);
    components.push(newComp);
}


function handleCanvasInteraction(x, y, e = null) {
    if (renameInput) {
        if (e && e.target !== renameInput) { exitRenameMode(); }
        return;
    }
    
    if (selectedWire && wireEditorUI.colorRect) {
        const cr = wireEditorUI.colorRect; const tr = wireEditorUI.thickRect; const dr = wireEditorUI.deleteRect;
        if (x >= cr.x && x <= cr.x + cr.width && y >= cr.y && y <= cr.y + cr.height) { selectedWire.color = WIRE_COLORS[selectedWire.color] || '#f6e05e'; draw(); return; }
        if (x >= tr.x && x <= tr.x + tr.width && y >= tr.y && y <= tr.y + tr.height) { selectedWire.thickness = WIRE_THICKNESS[selectedWire.thickness] || 3; draw(); return; }
        if (x >= dr.x && x <= dr.x + dr.width && y >= dr.y && y <= dr.y + dr.height) { wires = wires.filter(w => w.id !== selectedWire.id); selectedWire = null; draw(); return; }
    }

    const isComponentTool = !['move', 'wire', 'rename', 'query', 'delete', null].includes(activeToolType);
    if (isComponentTool) {
        selectedComponent = null;
        const clickedOnComponent = components.some(c => c.isUnderMouse(x, y));
        const sX = snapToGrid(x); const sY = snapToGrid(y);

        if (placementPreview) {
            const tempPreviewComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
            if(tempPreviewComp.type === 'terminalBlock') tempPreviewComp.setVariant('6P', 'vertical');
            if(tempPreviewComp.type === 'relay') tempPreviewComp.setRelayType('2C');

            const mouseOnPreview = (x >= tempPreviewComp.x && x <= tempPreviewComp.x + tempPreviewComp.width && y >= tempPreviewComp.y && y <= tempPreviewComp.y + tempPreviewComp.height);
            
            if (mouseOnPreview) {
                const rect = { x: placementPreview.x, y: placementPreview.y, width: tempPreviewComp.width, height: tempPreviewComp.height };
                if (!checkCollision(rect)) {
                    const newComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
                    if (newComp) addComponentToCanvas(newComp);
                }
                placementPreview = null;
            } else {
                placementPreview = null;
            }
        } else if (!clickedOnComponent) {
            const tempComp = createTempComponent(activeToolType, sX, sY);
            if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
            if(tempComp.type === 'relay') tempComp.setRelayType('2C');
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
        
        if (activeToolType === 'query') {
            if (clickedComponent) { showInfoBox(clickedComponent); } else { hideInfoBox(); }
        } else if (activeToolType === 'rename') {
            if(clickedComponent) { selectedComponent = clickedComponent; enterRenameMode(clickedComponent); }
        } else if (activeToolType === 'delete') {
            if (clickedComponent) {
                wires = wires.filter(w => w.start.parent.id !== clickedComponent.id && w.end.parent.id !== clickedComponent.id);
                components = components.filter(c => c.id !== clickedComponent.id);
            } else {
                const wireToDelete = wires.find(w => { if (!w.path || w.path.length < 2) return false; for (let i = 0; i < w.path.length - 1; i++) { if (pDistance(x, y, w.path[i].x, w.path[i].y, w.path[i+1].x, w.path[i+1].y) < 5) return true; } return false; });
                if (wireToDelete) wires = wires.filter(w => w.id !== wireToDelete.id);
            }
            selectedWire = null; selectedComponent = null;
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
                    if (clickedComponent.type !== 'relay') {
                        clickedComponent.handleInteraction(x, y, 'click');
                    }
                }
                somethingWasClicked = true;
            }
            if (!somethingWasClicked) { selectedWire = null; selectedComponent = null; }
        }
    }
    draw();
}


canvas.addEventListener('mousemove', (e) => {
    const pos = getCanvasMousePos(e);
    if (interactingComponent && typeof interactingComponent.handleInteraction === 'function') {
        if (interactingComponent.handleInteraction(pos.x, pos.y, 'mousemove', pos)) {
            draw();
            return;
        }
    }

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
        const sX = snapToGrid(draggedGhost.x);
        const sY = snapToGrid(draggedGhost.y);
        const tempComp = createTempComponent(draggedGhost.type, sX, sY);
        if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
        if(tempComp.type === 'relay') tempComp.setRelayType('2C');

        draggedGhost.isColliding = checkCollision({ x: sX, y: sY, width: tempComp.width, height: tempComp.height });
    }
    draw();
});

canvas.addEventListener('click', (e) => {
    if (justDragged) return;
    const { x, y } = getCanvasMousePos(e);
    handleCanvasInteraction(x,y, e);
});

canvas.addEventListener('dblclick', (e) => {
    if (renameInput) return;
    const { x, y } = getCanvasMousePos(e); 
    handleCanvasDoubleClick(x,y);
});

function handleCanvasDoubleClick(x,y) {
    if (activeToolType === 'wire' && wiringState.start) {
        wiringState = { start: null, end: null };
        wiringPathPoints = [];
        handleToolClick(document.getElementById('wire-tool'));
    }
    closeGenericEditModal();
    const clickedComponent = components.find(c => c.isUnderMouse(x, y));
    if (clickedComponent) {
        selectedComponentForEdit = clickedComponent;
        if (clickedComponent.type === 'bulb') {
            clickedComponent.cycleColor();
            draw();
        } else if (clickedComponent.type === 'fuse' && clickedComponent.isBlown) {
            clickedComponent.isBlown = false;
            draw();
        } else {
             openGenericEditModal(clickedComponent);
        }
    }
}

canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasMousePos(e);
    
    const compUnderMouse = components.find(c => c.isUnderMouse(pos.x, pos.y));
    if (compUnderMouse && typeof compUnderMouse.handleInteraction === 'function') {
        if (compUnderMouse.handleInteraction(pos.x, pos.y, 'mousedown', pos)) {
            interactingComponent = compUnderMouse;
            draw();
            return;
        }
    }

    if (e.button === 1) {
        if (renameInput) exitRenameMode();
        isPanning = true;
        panStart = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }
    
    justDragged = false;
    
    if (renameInput && e.target !== renameInput) {
        exitRenameMode();
    }
    
    const comp = components.find(c => c.isUnderMouse(pos.x, pos.y));
    const tempPreviewComp = placementPreview ? createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y) : null;
    if(tempPreviewComp) {
        if(tempPreviewComp.type === 'terminalBlock') tempPreviewComp.setVariant('6P', 'vertical');
        if(tempPreviewComp.type === 'relay') tempPreviewComp.setRelayType('2C');
    }
    const mouseOnPreview = tempPreviewComp && (pos.x >= tempPreviewComp.x && pos.x <= tempPreviewComp.x + tempPreviewComp.width && pos.y >= tempPreviewComp.y && pos.y <= tempPreviewComp.y + tempPreviewComp.height);
    const isComponentTool = !['move', 'wire', 'rename', 'query', 'delete', null].includes(activeToolType);

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
    const pos = getCanvasMousePos(e);
    if (interactingComponent && typeof interactingComponent.handleInteraction === 'function') {
        if(interactingComponent.handleInteraction(pos.x, pos.y, 'mouseup', pos)) {
            interactingComponent = null;
            draw();
            return;
        }
    }

    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'default';
    }
    clearTimeout(longPressTimer); longPressTimer = null;
    
    if (isDraggingPreview){
        const tempComp = createTempComponent(placementPreview.type, placementPreview.x, placementPreview.y);
        if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
        if(tempComp.type === 'relay') tempComp.setRelayType('2C');
        const rect = { x: placementPreview.x, y: placementPreview.y, width: tempComp.width, height: tempComp.height };
        if(checkCollision(rect)){
           placementPreview = null;
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

toolbar.addEventListener('dragstart', (e) => {
    const toolItem = e.target.closest('.tool-item');
    if(toolItem && toolItem.draggable){
         draggedToolType = toolItem.dataset.type;
         const tempComp = createTempComponent(draggedToolType, 0, 0);
         if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
         if(tempComp.type === 'relay') tempComp.setRelayType('2C');
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
    if(tempComp.type === 'terminalBlock') tempComp.setVariant('6P', 'vertical');
    if(tempComp.type === 'relay') tempComp.setRelayType('2C');

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
        if(newComp) addComponentToCanvas(newComp);
        if (activeToolType === 'delete') {
            handleToolClick(document.getElementById('delete-tool'));
        }
    }
    draggedToolType = null;
    draggedGhost = null;
    draw();
});

window.addEventListener('keydown', (e) => { 
    if (selectedComponent && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = GRID_SIZE / 2;
        let newX = selectedComponent.x;
        let newY = selectedComponent.y;

        switch (e.key) {
            case 'ArrowUp':    newY -= step; break;
            case 'ArrowDown':  newY += step; break;
            case 'ArrowLeft':  newX -= step; break;
            case 'ArrowRight': newX += step; break;
        }

        const rect = { x: newX, y: newY, width: selectedComponent.width, height: selectedComponent.height };
        if (!checkCollision(rect, selectedComponent.id)) {
            selectedComponent.updatePosition(newX, newY);
        }
        draw();
        return;
    }
    
    if (e.key === 'Escape' && !renameInput) { 
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

// --- RENAME LOGIC ---
function exitRenameMode() {
    if (!renameInput || !componentBeingRenamed) return;

    const newName = renameInput.value.trim();
    if (componentBeingRenamed.type === 'bulb') {
        const newColor = bulbColors.find(c => c.label.toLowerCase() === newName.toLowerCase());
        if (newColor) {
            componentBeingRenamed.setName(newName);
        } else {
            componentBeingRenamed.displayName = newName;
        }
    }
    else if (typeof componentBeingRenamed.setName === 'function') {
         componentBeingRenamed.setName(newName);
    } else {
         componentBeingRenamed.name = newName;
    }
    applyDescriptionToComponent(componentBeingRenamed);

    renameInput.remove();
    renameInput = null;
    componentBeingRenamed = null;
    draw();
}

function enterRenameMode(component) {
    if (renameInput) exitRenameMode();
    if (typeof component.getNamePosition === 'function') {
        const pos = component.getNamePosition();
        if (!pos) return;
        
        const screenX = pos.x * view.scale + view.tx;
        const screenY = pos.y * view.scale + view.ty;
        const screenWidth = pos.width * view.scale;
        const screenHeight = pos.height * view.scale;
        const fontSize = (pos.fontSize || GRID_SIZE * 0.9) * view.scale;

        renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = pos.value;
        renameInput.className = 'rename-input';
        renameInput.style.left = `${screenX}px`;
        renameInput.style.top = `${screenY}px`;
        renameInput.style.width = `${screenWidth}px`;
        renameInput.style.height = `${screenHeight}px`;
        renameInput.style.fontSize = `${fontSize}px`;
        
        componentBeingRenamed = component;

        renameInput.addEventListener('blur', exitRenameMode);
        renameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                renameInput.blur();
            } else if (e.key === 'Escape') {
                renameInput.value = componentBeingRenamed.name || '';
                renameInput.blur();
            }
        });

        canvasContainer.appendChild(renameInput);
        renameInput.focus();
        renameInput.select();
    }
}

// --- MODAL LOGIC ---
function applyDescriptionToComponent(component) {
    if (!component) return;
    const key = component.getDescriptionKey();
    if (componentDescriptionMap.has(key)) {
        component.description = componentDescriptionMap.get(key);
    } else {
        delete component.description;
    }
}

function closeGenericEditModal() {
    genericEditModal.classList.add('hidden');
    selectedComponentForEdit = null;
}

function openGenericEditModal(component) {
    selectedComponentForEdit = component;
    editOptionsContainer.innerHTML = '';
    editNumericInputsContainer.innerHTML = '';
    editOptionsContainer.className = '';
    
    const createButton = (text, dataset) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.entries(dataset).forEach(([key, value]) => btn.dataset[key] = value);
        btn.className = 'edit-option-btn bg-blue-600 hover:bg-blue-700 p-2 rounded text-sm';
        return btn;
    };
    
    const createNumericInput = (label, id, value, unit) => `
        <div class="flex items-center justify-center space-x-2 p-2 bg-gray-600 rounded">
            <label for="${id}" class="text-sm font-medium text-gray-300">${label}:</label>
            <input type="number" id="${id}" value="${value}" class="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-24 p-2.5 text-center">
            <span class="text-sm text-gray-300">${unit}</span>
        </div>
    `;

    switch(component.type) {
        case 'power':
            modalTitle.textContent = '編輯電源';
            editOptionsContainer.className = 'grid grid-cols-2 gap-4';
            editOptionsContainer.append(
                createButton('單相 (110V)', { phase: '1P' }),
                createButton('三相 (220V)', { phase: '3P' })
            );
            editNumericInputsContainer.innerHTML = createNumericInput('電壓 (V)', 'param-input', component.voltage, 'V');
            break;
        case 'nfb':
        case 'fuse':
        case 'th-ry':
        case 'resistor': {
            const typeName = {nfb: 'NFB', fuse: '保險絲', 'th-ry': '積熱電驛', resistor: '電阻器'}[component.type];
            modalTitle.textContent = `編輯 ${typeName}`;
            if(component.type === 'nfb') {
                editOptionsContainer.className = 'grid grid-cols-2 md:grid-cols-4 gap-2';
                editOptionsContainer.append(...['1P', '2P', '3P', '4P'].map(p => createButton(p, { pole: p })))
            };
            if(component.type === 'th-ry') {
                editOptionsContainer.className = 'grid grid-cols-2 gap-4';
                editOptionsContainer.append(...[createButton('標準型 (97-98/95-96)', { thRyType: 'A'}), createButton('共點型 (95-98/95-96)', { thRyType: 'B' })])
            };
            if(component.amperageLimit != null) editNumericInputsContainer.innerHTML = createNumericInput('安培 (A)', 'param-input', component.amperageLimit, 'A');
            if(component.type === 'resistor') editNumericInputsContainer.innerHTML = createNumericInput('電阻 (Ω)', 'param-input', component.resistance, 'Ω');
            break;
        }
        case 'ammeter': {
            modalTitle.textContent = '編輯安培表';
            const scales = ['5A', '10A', '15A', '20A', '30A', '50A', '100A', '200A'];
            const buttons = scales.map(s => createButton(s, { scale: s }));
            buttons.push(createButton('自訂', { scale: 'Custom' }));
            editOptionsContainer.className = 'grid grid-cols-2 md:grid-cols-3 gap-2';
            editOptionsContainer.append(...buttons);
            editNumericInputsContainer.innerHTML = createNumericInput('自訂最大值', 'param-input', component.maxValue, 'A');
            break;
        }
        case 'switch':
            modalTitle.textContent = '選擇開關類型';
            editOptionsContainer.className = 'grid grid-cols-2 gap-4';
            editOptionsContainer.append(
                createButton('按鈕 (常開 NO)', { switchType: 'pushbutton_no' }),
                createButton('按鈕 (常閉 NC)', { switchType: 'pushbutton_nc' }),
                createButton('二段選擇開關', { switchType: 'rotary_2pos' }),
                createButton('三段選擇開關', { switchType: 'rotary_3pos' })
            );
            break;
        case 'contactor':
            modalTitle.textContent = '編輯電磁接觸器';
            const auxButton = component.hasLeftAux 
                ? createButton('移除輔助接點', { aux: 'remove' }) 
                : createButton('加裝輔助接點', { aux: 'add' });
            auxButton.className = `edit-option-btn p-2 rounded text-sm ${component.hasLeftAux ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`;
            editOptionsContainer.append(auxButton);
            break;
        case 'relay':
            modalTitle.textContent = '選擇繼電器類型';
            editOptionsContainer.className = 'grid grid-cols-2 md:grid-cols-3 gap-4';
            editOptionsContainer.append(...Object.keys(RELAY_DATA).map(type => createButton(RELAY_DATA[type].name, { relayType: type })));
            break;
        case 'motor':
            modalTitle.textContent = '選擇馬達類型';
             editOptionsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
            editOptionsContainer.append(
                createButton('三相六接點馬達', { motorType: '3-phase-6' }),
                createButton('單相三線式馬達', { motorType: '1-phase-3' }),
                createButton('單相二線式馬達', { motorType: '1-phase-2' })
            );
            break;
        case 'terminalBlock':
            modalTitle.textContent = '編輯端子台';
            const poles = ['6P', '7P', '12P', '15P', '25P'];
            const orientations = [{val: 'vertical', text: '直式'}, {val: 'horizontal', text: '橫式'}];
            editOptionsContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-300 mb-2">P數 (Poles)</label>
                <div class="grid grid-cols-3 gap-2 mb-4">${poles.map(p => `<button data-pole="${p}" class="edit-option-btn bg-blue-600 p-2 rounded">${p}</button>`).join('')}</div>
                <label class="block text-sm font-medium text-gray-300 mb-2">方向 (Orientation)</label>
                <div class="grid grid-cols-2 gap-2">${orientations.map(o => `<button data-orientation="${o.val}" class="edit-option-btn bg-green-600 p-2 rounded">${o.text}</button>`).join('')}</div>
            `;
            break;
        default:
            closeGenericEditModal(); // No edit options for this component
            return;
    }

    genericEditModal.classList.remove('hidden');
}

genericEditModal.addEventListener('click', (e) => {
    const button = e.target.closest('.edit-option-btn');
    if (button && selectedComponentForEdit) {
        const { pole, switchType, aux, relayType, thRyType, motorType, orientation, scale, phase } = button.dataset;
        if (pole) selectedComponentForEdit.setPoles(pole);
        if (phase) selectedComponentForEdit.setPhaseType(phase);
        if (switchType) {
            const wasPushButton = selectedComponentForEdit.switchType.startsWith('pushbutton');
            const wasRotary = selectedComponentForEdit.switchType.startsWith('rotary');
            selectedComponentForEdit.setSwitchType(switchType);
            const isPushButton = selectedComponentForEdit.switchType.startsWith('pushbutton');
            const isRotary = selectedComponentForEdit.switchType.startsWith('rotary');
            if (isRotary && !wasRotary) selectedComponentForEdit.name = 'COS' + getNextNumberForType('rotary_switch');
            else if (isPushButton && !wasPushButton) selectedComponentForEdit.name = 'PB' + getNextNumberForType('pushbutton');
        }
        if (aux) selectedComponentForEdit.hasLeftAux = (aux === 'add');
        if (relayType) selectedComponentForEdit.setRelayType(relayType);
        if (thRyType) selectedComponentForEdit.setRelayType(thRyType);
        if (motorType) selectedComponentForEdit.setMotorType(motorType);
        if (orientation) selectedComponentForEdit.setVariant(selectedComponentForEdit.poleType, orientation);
        if (scale) selectedComponentForEdit.setScaleType(scale);
        
        applyDescriptionToComponent(selectedComponentForEdit);
        // For instant-update buttons, redraw and potentially close modal
        if (!['pole', 'orientation'].includes(Object.keys(button.dataset)[0])) {
             closeGenericEditModal();
        }
        draw();
    }
});

saveModalBtn.addEventListener('click', () => {
    if (selectedComponentForEdit) {
        const input = document.getElementById('param-input');
        if (input) {
            const value = parseFloat(input.value);
            if (!isNaN(value) && value >= 0) {
                 if(selectedComponentForEdit.amperageLimit != null) selectedComponentForEdit.amperageLimit = value;
                 if(selectedComponentForEdit.type === 'resistor') selectedComponentForEdit.resistance = value;
                 if(selectedComponentForEdit.type === 'power') selectedComponentForEdit.voltage = value;
                 if(selectedComponentForEdit.type === 'ammeter') {
                    selectedComponentForEdit.scaleType = 'Custom';
                    selectedComponentForEdit.maxValue = value;
                 }
            }
        }
    }
    closeGenericEditModal();
    draw();
});

// --- SAVE/LOAD/CSV LOGIC ---
function parseDataFromArray(dataArray) {
    const descriptionMap = new Map();
    dataArray.forEach(row => {
        const trimmedRow = row.trim();
        if (trimmedRow) {
            const separatorIndex = trimmedRow.indexOf(',');
            if (separatorIndex > 0) {
                const componentName = trimmedRow.substring(0, separatorIndex).trim();
                const description = trimmedRow.substring(separatorIndex + 1).trim();
                if (componentName) {
                    descriptionMap.set(componentName, description);
                }
            }
        }
    });
    return descriptionMap;
}

function applyDescriptions(descriptionMap) {
    components.forEach(comp => {
        applyDescriptionToComponent(comp);
    });
    if (infoBoxTarget) {
        showInfoBox(infoBoxTarget);
    }
}

function loadInitialDescriptions() {
    try {
        if (typeof componentDetailsData !== 'undefined') {
            componentDescriptionMap = parseDataFromArray(componentDetailsData);
        } else {
            console.warn('找不到 componentDetailsData 資料。元件說明將無法使用。');
        }
    } catch (error) {
        console.error("載入或解析內嵌元件說明時發生錯誤:", error);
    }
}


function getNextNumberForType(type) {
    let prefix = '';
    let filterFn = (c) => c.type === type;

    const prefixMap = {
        power: 'PS', contactor: 'MC', motor: 'M', terminalBlock: 'TB',
        'th-ry': 'TH', nfb: 'NFB', fuse: 'F', resistor: 'R', ammeter: 'A',
        bulb: 'PL', rotary_switch: 'COS', pushbutton: 'PB',
        relay_pr: 'PR', relay_tr: 'TR', relay_tr_delta: 'TR'
    };
    prefix = prefixMap[type];
    if(!prefix) return 1;

    if (type === 'rotary_switch') filterFn = c => c.type === 'switch' && c.switchType.startsWith('rotary');
    else if (type === 'pushbutton') filterFn = c => c.type === 'switch' && c.switchType.startsWith('pushbutton');
    else if (type === 'relay_pr') filterFn = c => c.type === 'relay' && ['2C', '3C', '4C'].includes(c.relayType);
    else if (type === 'relay_tr') filterFn = c => c.type === 'relay' && c.relayType === 'ON-delay';
    else if (type === 'relay_tr_delta') filterFn = c => c.type === 'relay' && c.relayType.startsWith('Y-delta');


    const existing = components.filter(filterFn);
    let maxNum = 0;
    
    existing.forEach(comp => {
        const nameToTest = (type === 'bulb' && comp.displayName) ? comp.displayName : comp.name;
        if (nameToTest && nameToTest.startsWith(prefix)) {
            let numStr = nameToTest.substring(prefix.length).replace('-Δ', '');
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    return maxNum + 1;
}

function saveLayout() {
    const layout = {
        components: components.map(c => {
            const data = { id: c.id, type: c.type, x: c.x, y: c.y, name: c.name };
            if (c.displayName) data.displayName = c.displayName;
            if (c.poleType) data.poleType = c.poleType;
            if (c.switchType) data.switchType = c.switchType;
            if (c.relayType) data.relayType = c.relayType;
            if (c.motorType) data.motorType = c.motorType;
            if (c.orientation) data.orientation = c.orientation;
            if (c.colorIndex !== undefined) data.colorIndex = c.colorIndex;
            if (c.isOn !== undefined) data.isOn = c.isOn;
            if (c.isBlown !== undefined) data.isBlown = c.isBlown;
            if (c.isTripped !== undefined) data.isTripped = c.isTripped;
            if (c.position) data.position = c.position;
            if (c.hasLeftAux !== undefined) data.hasLeftAux = c.hasLeftAux;
            if (c.knobs) data.knobs = c.knobs;
            if (c.amperageLimit != null) data.amperageLimit = c.amperageLimit;
            if (c.resistance != null) data.resistance = c.resistance;
            if (c.maxValue != null) data.maxValue = c.maxValue;
            if (c.scaleType != null) data.scaleType = c.scaleType;
            if (c.voltage != null) data.voltage = c.voltage;
            if (c.phaseType != null) data.phaseType = c.phaseType;
            return data;
        }),
        wires: wires.map(w => ({
            id: w.id, startConnectorId: w.start.id, endConnectorId: w.end.id,
            path: w.path, color: w.color, thickness: w.thickness
        })),
        nextId: nextId,
    };

    const dataStr = JSON.stringify(layout, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'circuit-layout.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

function loadLayout(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            reconstructLayout(JSON.parse(e.target.result));
        } catch (error) {
            console.error("Error parsing layout file:", error);
            alert("讀取檔案失敗，請確認檔案格式是否正確。");
        }
    };
    reader.readAsText(file);
    fileInput.value = '';
}

function reconstructLayout(layout) {
    components = []; wires = []; nextId = 0;

    layout.components.forEach(data => {
        let comp = createTempComponent(data.type, data.x, data.y);
        if (comp) {
            Object.assign(comp, data);
            if(comp.type === 'bulb' && data.name && data.colorIndex !== undefined){
                 comp.setName(data.name); 
                 if (data.displayName) comp.displayName = data.displayName;
            } else if (comp.type === 'terminalBlock'){
                 comp._updateFromVariant(data.poleType, data.orientation);
            } else if (comp.type === 'relay') {
                 comp.setRelayType(data.relayType);
                 if (data.knobs) comp.knobs = data.knobs;
            } else if (comp.type === 'power') {
                comp._updateDimensions();
                comp._rebuildConnectors();
            }
             else {
                comp._updateDimensions();
                comp._rebuildConnectors();
            }
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
            Object.assign(wire, data);
            wires.push(wire);
        }
    });

    nextId = layout.nextId || 0;
    applyDescriptions(componentDescriptionMap);
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

infoBoxClose.addEventListener('click', hideInfoBox);
imageViewerClose.addEventListener('click', () => imageViewerModal.classList.add('hidden'));

canvas.addEventListener('wheel', e => {
    if (renameInput) exitRenameMode();
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
}, { passive: true });

canvas.addEventListener('touchstart', e => { e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); }, { passive: false });

saveButton.addEventListener('click', saveLayout);
loadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', loadLayout);

let lastTime = 0;
function animate(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    components.forEach(c => {
        if (typeof c.updateLogic === 'function') {
            c.updateLogic(deltaTime);
        }
    });

    runSimulation();
    draw();
    requestAnimationFrame(animate);
}

resizeCanvas();
loadInitialDescriptions();
lastTime = performance.now();
requestAnimationFrame(animate);
wireColorPicker.style.backgroundColor = defaultWireColor;

