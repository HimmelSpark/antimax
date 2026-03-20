import { useRef, useCallback, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Arrow, Text, Group, Transformer, Image as KonvaImage } from 'react-konva';
import { useCanvasStore } from '../../store/canvasStore';
import { useAuthStore } from '../../store/authStore';
import { STICKY_COLORS } from '../../utils/colors';
import api from '../../api/client';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export default function WhiteboardCanvas({ yjs }) {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const newElementRef = useRef(null);
  const undoManagerRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [pendingEditId, setPendingEditId] = useState(null);
  const user = useAuthStore((s) => s.user);

  const { tool, color, strokeColor, strokeWidth, fontSize, zoom, stagePos, selectedIds,
    setZoom, setStagePos, setSelectedIds, setTool } = useCanvasStore();

  const [loadedImages, setLoadedImages] = useState({});

  useEffect(() => {
    undoManagerRef.current = yjs.getUndoManager();
    return () => undoManagerRef.current?.destroy();
  }, [yjs]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          undoManagerRef.current?.redo();
        } else {
          undoManagerRef.current?.undo();
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0 && document.activeElement === document.body) {
          yjs.deleteElements(selectedIds);
          setSelectedIds([]);
        }
      }

      if (e.key === 'Escape') {
        setSelectedIds([]);
        setTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, yjs, setSelectedIds, setTool]);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const nodes = selectedIds.map((id) => stage.findOne(`#${id}`)).filter(Boolean);
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, yjs.elements]);

  const loadImage = useCallback((src) => {
    if (loadedImages[src]) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadedImages((prev) => ({ ...prev, [src]: img }));
    };
    img.src = src;
  }, [loadedImages]);

  useEffect(() => {
    yjs.elements.forEach((el) => {
      if (el.type === 'image' && el.src && !loadedImages[el.src]) {
        loadImage(el.src);
      }
    });
  }, [yjs.elements, loadedImages, loadImage]);

  const genId = () => `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const getPointerPos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: (pos.x - stagePos.x) / zoom,
      y: (pos.y - stagePos.y) / zoom,
    };
  }, [zoom, stagePos]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    const oldZoom = zoom;
    const delta = e.evt.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * delta));

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldZoom,
      y: (pointer.y - stagePos.y) / oldZoom,
    };

    setZoom(newZoom);
    setStagePos({
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    });
  }, [zoom, stagePos, setZoom, setStagePos]);

  const handleMouseDown = useCallback((e) => {
    const pos = getPointerPos();

    if (tool === 'select') {
      if (e.target === stageRef.current) {
        setSelectedIds([]);
      }
      return;
    }

    isDrawingRef.current = true;
    const id = genId();

    let elementData;
    switch (tool) {
      case 'rect':
        elementData = { type: 'rect', x: pos.x, y: pos.y, width: 0, height: 0, fill: color, stroke: strokeColor, strokeWidth, rotation: 0, zIndex: Date.now() };
        break;
      case 'circle':
        elementData = { type: 'circle', x: pos.x, y: pos.y, radiusX: 0, radiusY: 0, fill: color, stroke: strokeColor, strokeWidth, rotation: 0, zIndex: Date.now() };
        break;
      case 'triangle':
        elementData = { type: 'triangle', x: pos.x, y: pos.y, width: 0, height: 0, fill: color, stroke: strokeColor, strokeWidth, rotation: 0, zIndex: Date.now() };
        break;
      case 'line':
        elementData = { type: 'line', points: [pos.x, pos.y, pos.x, pos.y], stroke: strokeColor, strokeWidth, zIndex: Date.now() };
        break;
      case 'arrow':
        elementData = { type: 'arrow', points: [pos.x, pos.y, pos.x, pos.y], stroke: strokeColor, strokeWidth, fill: strokeColor, zIndex: Date.now() };
        break;
      case 'sticky': {
        const stickyColor = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
        elementData = { type: 'sticky', x: pos.x, y: pos.y, width: 200, height: 200, fill: stickyColor, text: '', fontSize: 14, rotation: 0, zIndex: Date.now() };
        yjs.addElement(id, elementData);
        setTool('select');
        setSelectedIds([id]);
        setPendingEditId(id);
        return;
      }
      case 'text':
        elementData = { type: 'text', x: pos.x, y: pos.y, text: 'Text', fontSize, fill: color, width: 200, rotation: 0, zIndex: Date.now() };
        yjs.addElement(id, elementData);
        setTool('select');
        setSelectedIds([id]);
        return;
      default:
        return;
    }

    newElementRef.current = { id, startX: pos.x, startY: pos.y, type: elementData.type };
    yjs.addElement(id, elementData);
  }, [tool, color, strokeColor, strokeWidth, fontSize, getPointerPos, yjs, setTool, setSelectedIds]);

  const handleMouseMove = useCallback((e) => {
    const pos = getPointerPos();

    yjs.sendAwareness({ cursor: pos });

    if (!isDrawingRef.current || !newElementRef.current) return;

    const { id, startX, startY, type } = newElementRef.current;

    const dx = pos.x - startX;
    const dy = pos.y - startY;

    switch (type) {
      case 'rect':
      case 'triangle':
        yjs.updateElement(id, {
          x: dx < 0 ? pos.x : startX,
          y: dy < 0 ? pos.y : startY,
          width: Math.abs(dx),
          height: Math.abs(dy),
        });
        break;
      case 'circle':
        yjs.updateElement(id, {
          x: (startX + pos.x) / 2,
          y: (startY + pos.y) / 2,
          radiusX: Math.abs(dx) / 2,
          radiusY: Math.abs(dy) / 2,
        });
        break;
      case 'line':
      case 'arrow':
        yjs.updateElement(id, { points: [startX, startY, pos.x, pos.y] });
        break;
    }
  }, [getPointerPos, yjs]);

  const handleMouseUp = useCallback(() => {
    if (isDrawingRef.current && newElementRef.current) {
      const id = newElementRef.current.id;
      setSelectedIds([id]);
      setTool('select');
    }
    isDrawingRef.current = false;
    newElementRef.current = null;
  }, [setSelectedIds, setTool]);

  const handleDragEnd = useCallback((id, e) => {
    const node = e.target;
    const el = yjs.elements.get(id);
    if (el && (el.type === 'line' || el.type === 'arrow')) {
      // Lines/arrows store position in points, not x/y.
      // Apply the drag offset to each point and reset node position.
      const dx = node.x();
      const dy = node.y();
      const points = el.points || [];
      const newPoints = points.map((v, i) => i % 2 === 0 ? v + dx : v + dy);
      node.position({ x: 0, y: 0 });
      yjs.updateElement(id, { points: newPoints });
    } else {
      yjs.updateElement(id, { x: node.x(), y: node.y() });
    }
  }, [yjs]);

  const handleTransformEnd = useCallback((id, e) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const updates = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    };

    const el = yjs.elements.get(id);
    if (!el) return;

    if (el.type === 'circle') {
      updates.radiusX = Math.max(5, (el.radiusX || 50) * Math.abs(scaleX));
      updates.radiusY = Math.max(5, (el.radiusY || 50) * Math.abs(scaleY));
    } else if (el.type === 'line' || el.type === 'arrow') {
      const points = el.points || [];
      updates.points = points.map((v, i) => i % 2 === 0 ? v * scaleX : v * scaleY);
    } else {
      updates.width = Math.max(5, node.width() * scaleX);
      updates.height = Math.max(5, node.height() * scaleY);
    }

    yjs.updateElement(id, updates);
  }, [yjs]);

  const handleSelect = useCallback((id, e) => {
    if (tool !== 'select') return;
    e.cancelBubble = true;
    if (e.evt.shiftKey) {
      setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
    } else {
      setSelectedIds([id]);
    }
  }, [tool, selectedIds, setSelectedIds]);

  const handleTextDblClick = useCallback((id, el) => {
    const stage = stageRef.current;
    const textNode = stage.findOne(`#${id}`);
    if (!textNode) return;

    const stageBox = stage.container().getBoundingClientRect();
    const absTransform = textNode.getAbsoluteTransform();
    const nodePos = absTransform.point({ x: 0, y: 0 });
    const areaPosition = { x: stageBox.left + nodePos.x, y: stageBox.top + nodePos.y };

    // Hide the Konva element before creating the textarea
    setEditingId(id);

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const isSticky = el.type === 'sticky';
    const padding = isSticky ? 10 * zoom : 4;

    textarea.value = el.text || '';
    textarea.style.position = 'absolute';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${(el.width || 200) * zoom}px`;
    textarea.style.height = `${(el.height || 100) * zoom}px`;
    textarea.style.fontSize = `${(el.fontSize || 14) * zoom}px`;
    textarea.style.border = 'none';
    textarea.style.padding = `${padding}px`;
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.background = isSticky ? el.fill : 'transparent';
    textarea.style.color = isSticky ? '#1a1a1a' : el.fill || '#fff';
    textarea.style.outline = '2px solid var(--primary)';
    textarea.style.resize = 'none';
    textarea.style.fontFamily = 'Inter, sans-serif';
    textarea.style.lineHeight = '1.4';
    textarea.style.zIndex = '10000';
    textarea.style.transformOrigin = 'left top';
    textarea.style.boxSizing = 'border-box';
    if (isSticky) {
      textarea.style.borderRadius = `${8 * zoom}px`;
      textarea.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    }
    textarea.focus();

    const handleBlur = () => {
      yjs.updateElement(id, { text: textarea.value });
      document.body.removeChild(textarea);
      setEditingId(null);
    };
    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') textarea.blur();
    });
  }, [yjs, zoom, stagePos]);

  // Auto-edit newly created sticky notes
  useEffect(() => {
    if (!pendingEditId) return;
    const el = yjs.elements.get(pendingEditId);
    if (!el) return;
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.findOne(`#${pendingEditId}`);
    if (!node) return;
    setPendingEditId(null);
    handleTextDblClick(pendingEditId, el);
  }, [pendingEditId, yjs.elements, handleTextDblClick]);

  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        const formData = new FormData();
        formData.append('file', blob, `paste-${Date.now()}.png`);
        formData.append('boardId', window.location.pathname.split('/').pop());
        try {
          const { data } = await api.post('/upload', formData);
          const id = genId();
          yjs.addElement(id, {
            type: 'image',
            x: 100,
            y: 100,
            width: 300,
            height: 300,
            src: data.url,
            rotation: 0,
            zIndex: Date.now(),
          });
        } catch (err) {
          console.error('Paste upload failed:', err);
        }
        break;
      }
    }
  }, [yjs]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files?.length) return;

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('boardId', window.location.pathname.split('/').pop());
      try {
        const { data } = await api.post('/upload', formData);
        const id = genId();
        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition() || { x: 200, y: 200 };
        yjs.addElement(id, {
          type: 'image',
          x: (pointer.x - stagePos.x) / zoom,
          y: (pointer.y - stagePos.y) / zoom,
          width: 300,
          height: 300,
          src: data.url,
          rotation: 0,
          zIndex: Date.now(),
        });
      } catch (err) {
        console.error('Drop upload failed:', err);
      }
    }
  }, [yjs, zoom, stagePos]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const sortedElements = Array.from(yjs.elements.entries()).sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0));

  const renderElement = ([id, el]) => {
    const commonProps = {
      id,
      draggable: tool === 'select',
      onClick: (e) => handleSelect(id, e),
      onDragEnd: (e) => handleDragEnd(id, e),
      onTransformEnd: (e) => handleTransformEnd(id, e),
    };

    switch (el.type) {
      case 'rect':
        return <Rect key={id} {...commonProps} x={el.x} y={el.y} width={el.width} height={el.height}
          fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} rotation={el.rotation} />;
      case 'circle':
        return <Ellipse key={id} {...commonProps} x={el.x} y={el.y} radiusX={el.radiusX || 0} radiusY={el.radiusY || 0}
          fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} rotation={el.rotation} />;
      case 'triangle':
        return (
          <Line key={id} {...commonProps} x={el.x} y={el.y} closed
            points={[el.width / 2, 0, el.width, el.height, 0, el.height]}
            fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} rotation={el.rotation} />
        );
      case 'line':
        return <Line key={id} {...commonProps} points={el.points} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
      case 'arrow':
        return <Arrow key={id} {...commonProps} points={el.points} stroke={el.stroke} strokeWidth={el.strokeWidth}
          fill={el.fill} pointerLength={10} pointerWidth={10} />;
      case 'sticky':
        return (
          <Group key={id} {...commonProps} x={el.x} y={el.y} rotation={el.rotation}
            visible={editingId !== id}
            onDblClick={() => handleTextDblClick(id, el)}>
            <Rect width={el.width} height={el.height} fill={el.fill}
              cornerRadius={8} shadowColor="rgba(0,0,0,0.2)" shadowBlur={8} shadowOffsetY={2} />
            <Text text={el.text} width={el.width - 20} height={el.height - 20}
              x={10} y={10} fontSize={el.fontSize || 14} fill="#1a1a1a"
              lineHeight={1.4} wrap="word" />
          </Group>
        );
      case 'text':
        return (
          <Text key={id} {...commonProps} x={el.x} y={el.y} text={el.text}
            fontSize={el.fontSize} fill={el.fill} width={el.width}
            visible={editingId !== id}
            rotation={el.rotation} onDblClick={() => handleTextDblClick(id, el)} />
        );
      case 'image': {
        const img = loadedImages[el.src];
        if (!img) return null;
        return <KonvaImage key={id} {...commonProps} x={el.x} y={el.y}
          width={el.width} height={el.height} image={img} rotation={el.rotation} />;
      }
      default:
        return null;
    }
  };

  return (
    <div onDrop={handleDrop} onDragOver={handleDragOver} style={{ width: '100%', height: '100%' }}>
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight - 48}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePos.x}
        y={stagePos.y}
        draggable={tool === 'select' && selectedIds.length === 0}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {sortedElements.map(renderElement)}
          <Transformer ref={transformerRef} boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width: Math.max(10, newBox.width),
            height: Math.max(10, newBox.height),
          })} />
        </Layer>
      </Stage>
    </div>
  );
}
