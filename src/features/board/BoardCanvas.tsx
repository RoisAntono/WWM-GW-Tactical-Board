import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Group, Image, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { CircleDot, Eraser, FileText, Flag, MousePointer2, Route } from 'lucide-react';
import { shouldReduceCanvasEffects } from '../../app/konvaPerformance';
import { usePlanStore } from '../../app/store';
import { assets } from '../../shared/assets';
import { defaultObjectiveCategoryVisibility, getObjectiveCategory, objectiveAssets, objectiveLabels, roleConfigs } from '../../shared/constants';
import { downloadDataUrl, downloadTextFile } from '../../shared/download';
import type { Coordinate, ObjectiveMarker, ObjectiveType, Player, PlayerMarker, Route as RouteModel } from '../../types/domain';
import { denormalize, mapSize, normalize, overlayScaleForView, routePoints } from './boardMath';
import { BoardToolbar } from './BoardToolbar';
import { useImageElement } from './useImageElement';
import { useResizeObserver } from './useResizeObserver';

export type BoardCanvasHandle = {
  exportPng: () => void;
};

type BoardCanvasProps = {
  selectedObjectiveType: ObjectiveType;
  onObjectiveTypeChange: (type: ObjectiveType) => void;
  presentationMode?: boolean;
  hideToolbar?: boolean;
};

type HoveredMarker = {
  marker: PlayerMarker;
  player: Player;
};

type ViewState = {
  x: number;
  y: number;
  scale: number;
  fitted: boolean;
};

type TouchZoomState = {
  distance: number;
  view: ViewState;
};

type TouchPanState = {
  point: Coordinate;
  view: ViewState;
};

type PointerPanState = {
  pointerId: number;
  point: Coordinate;
  view: ViewState;
};

export const BoardCanvas = forwardRef<BoardCanvasHandle, BoardCanvasProps>(function BoardCanvas(
  { selectedObjectiveType, onObjectiveTypeChange, presentationMode = false, hideToolbar = false },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);
  const viewRef = useRef<ViewState>({ x: 0, y: 0, scale: 0.16, fitted: false });
  const touchZoomRef = useRef<TouchZoomState | undefined>(undefined);
  const touchPanRef = useRef<TouchPanState | undefined>(undefined);
  const pointerPanRef = useRef<PointerPanState | undefined>(undefined);
  const cursorFrameRef = useRef<number | undefined>(undefined);
  const size = useResizeObserver(wrapperRef);
  const mapImage = useImageElement(assets.map, assets.mapFallback);
  const [hoveredMarker, setHoveredMarker] = useState<HoveredMarker>();
  const [cursorCoordinate, setCursorCoordinate] = useState<Coordinate>();
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 0.16, fitted: false });

  const {
    plan,
    activePhaseId,
    selectedPlayerId,
    selectedRouteId,
    selectedObjectiveId,
    selectedNoteId,
    tool,
    layerVisibility,
    objectiveCategoryVisibility,
    briefingMode,
    setTool,
    toggleLayer,
    toggleObjectiveCategory,
    selectPlayer,
    selectRoute,
    selectObjective,
    selectNote,
    addPlayerMarker,
    removePlayerMarker,
    movePlayerMarker,
    addRoutePoint,
    completeRoute,
    removeRoute,
    addObjective,
    moveObjective,
    removeObjective,
    replaceActiveObjectivesWithPreset,
    addZone,
    addNote,
    removeNote,
    removeSelected,
  } = usePlanStore();

  const activePhase = useMemo(
    () => plan.phases.find((phase) => phase.id === activePhaseId) ?? plan.phases[0],
    [activePhaseId, plan.phases],
  );

  const playerById = useMemo(
    () => new Map(plan.roster.map((player) => [player.id, player] as const)),
    [plan.roster],
  );

  const selectedRoute = activePhase?.routes.find((route) => route.id === selectedRouteId);
  const hasSelection = Boolean(selectedPlayerId || selectedRouteId || selectedObjectiveId || selectedNoteId);
  const readOnly = briefingMode || presentationMode;
  const reduceCanvasEffects = shouldReduceCanvasEffects();
  const useManualTouchPan = isCoarsePointer();
  const canPanBoard = presentationMode || (tool === 'select' && !briefingMode);

  const visibleObjectiveCategories = {
    ...defaultObjectiveCategoryVisibility,
    ...(objectiveCategoryVisibility ?? {}),
  };

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
      if (dataUrl) {
        downloadDataUrl(`${plan.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-board.png`, dataUrl);
      }
    },
  }));

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    return () => {
      if (cursorFrameRef.current !== undefined) {
        window.cancelAnimationFrame(cursorFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!size.width || !size.height || (!presentationMode && view.fitted)) {
      return;
    }

    const scale = Math.min(size.width / mapSize.width, size.height / mapSize.height) * 0.98;
    setView({
      scale,
      x: (size.width - mapSize.width * scale) / 2,
      y: (size.height - mapSize.height * scale) / 2,
      fitted: true,
    });
  }, [presentationMode, size.height, size.width]);

  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) {
      return;
    }

    if (event.evt.altKey || event.evt.shiftKey) {
      const panX = event.evt.shiftKey && !event.evt.altKey ? event.evt.deltaY : event.evt.deltaX;
      const panY = event.evt.altKey ? event.evt.deltaY : 0;

      setView((current) => ({
        ...current,
        x: current.x - panX,
        y: current.y - panY,
        fitted: true,
      }));
      return;
    }

    const scaleBy = 1.08;
    const nextScale = event.evt.deltaY > 0 ? view.scale / scaleBy : view.scale * scaleBy;
    const clampedScale = clampViewScale(nextScale);
    const mousePointTo = {
      x: (pointer.x - view.x) / view.scale,
      y: (pointer.y - view.y) / view.scale,
    };

    setView({
      scale: clampedScale,
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
      fitted: true,
    });
  };

  const handleTouchStart = (event: KonvaEventObject<TouchEvent>) => {
    const stage = stageRef.current;
    const stageContainer = stage?.container();
    if (event.evt.touches.length !== 2) {
      touchZoomRef.current = undefined;
      if (
        event.evt.touches.length === 1 &&
        stageContainer &&
        useManualTouchPan &&
        canPanBoard &&
        isBoardBackgroundTarget(event.target, stage, groupRef.current)
      ) {
        const touchPoint = getTouchPoint(event.evt.touches[0], stageContainer);
        event.evt.preventDefault();
        touchPanRef.current = {
          point: touchPoint,
          view: viewRef.current,
        };
      }
      return;
    }

    touchPanRef.current = undefined;
    const touchPair = getTouchPair(event.evt.touches, stageContainer);
    if (!touchPair) {
      return;
    }

    event.evt.preventDefault();
    touchZoomRef.current = {
      distance: touchPair.distance,
      view: viewRef.current,
    };
  };

  const handleTouchMove = (event: KonvaEventObject<TouchEvent>) => {
    const touchPan = touchPanRef.current;
    if (touchPan && event.evt.touches.length === 1) {
      const stageContainer = stageRef.current?.container();
      if (!stageContainer) {
        return;
      }

      const touchPoint = getTouchPoint(event.evt.touches[0], stageContainer);
      event.evt.preventDefault();
      setView({
        ...touchPan.view,
        x: touchPan.view.x + touchPoint.x - touchPan.point.x,
        y: touchPan.view.y + touchPoint.y - touchPan.point.y,
        fitted: true,
      });
      return;
    }

    const touchZoom = touchZoomRef.current;
    if (!touchZoom || event.evt.touches.length !== 2) {
      return;
    }

    const touchPair = getTouchPair(event.evt.touches, stageRef.current?.container());
    if (!touchPair || touchZoom.distance <= 0) {
      return;
    }

    event.evt.preventDefault();
    const nextScale = clampViewScale(touchZoom.view.scale * (touchPair.distance / touchZoom.distance));
    const mapPointTo = {
      x: (touchPair.midpoint.x - touchZoom.view.x) / touchZoom.view.scale,
      y: (touchPair.midpoint.y - touchZoom.view.y) / touchZoom.view.scale,
    };

    setView({
      scale: nextScale,
      x: touchPair.midpoint.x - mapPointTo.x * nextScale,
      y: touchPair.midpoint.y - mapPointTo.y * nextScale,
      fitted: true,
    });
  };

  const handleTouchEnd = (event: KonvaEventObject<TouchEvent>) => {
    if (event.evt.touches.length < 2) {
      touchZoomRef.current = undefined;
    }
    if (event.evt.touches.length === 0) {
      touchPanRef.current = undefined;
    }
  };

  const applyTransientPanView = (nextView: ViewState) => {
    viewRef.current = nextView;
    const group = groupRef.current;
    if (!group) {
      return;
    }

    group.x(nextView.x);
    group.y(nextView.y);
    group.getLayer()?.batchDraw();
  };

  const commitTransientPanView = () => {
    setView({ ...viewRef.current, fitted: true });
  };

  const scheduleCursorCoordinateUpdate = () => {
    if (cursorFrameRef.current !== undefined) {
      return;
    }

    cursorFrameRef.current = window.requestAnimationFrame(() => {
      cursorFrameRef.current = undefined;
      setCursorCoordinate(getNormalizedPointer());
    });
  };

  const clearCursorCoordinate = () => {
    if (cursorFrameRef.current !== undefined) {
      window.cancelAnimationFrame(cursorFrameRef.current);
      cursorFrameRef.current = undefined;
    }
    setCursorCoordinate(undefined);
  };

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (
      !stage ||
      !pointer ||
      event.evt.pointerType === 'touch' ||
      event.evt.button !== 0 ||
      !canPanBoard ||
      !isBoardBackgroundTarget(event.target, stage, groupRef.current)
    ) {
      return;
    }

    event.evt.preventDefault();
    pointerPanRef.current = {
      pointerId: event.evt.pointerId,
      point: pointer,
      view: viewRef.current,
    };
    stage.container().style.setProperty('cursor', 'grabbing');
  };

  const handlePointerMove = (event: KonvaEventObject<PointerEvent>) => {
    const pointer = stageRef.current?.getPointerPosition();
    const pointerPan = pointerPanRef.current;
    if (!pointer || !pointerPan || pointerPan.pointerId !== event.evt.pointerId) {
      scheduleCursorCoordinateUpdate();
      return;
    }

    event.evt.preventDefault();
    applyTransientPanView({
      ...pointerPan.view,
      x: pointerPan.view.x + pointer.x - pointerPan.point.x,
      y: pointerPan.view.y + pointer.y - pointerPan.point.y,
      fitted: true,
    });
  };

  const handlePointerEnd = (event: KonvaEventObject<PointerEvent>) => {
    const pointerPan = pointerPanRef.current;
    if (!pointerPan || pointerPan.pointerId !== event.evt.pointerId) {
      return;
    }

    pointerPanRef.current = undefined;
    event.target.getStage()?.container().style.setProperty('cursor', 'default');
    commitTransientPanView();
    scheduleCursorCoordinateUpdate();
  };

  const handlePointerLeave = (event: KonvaEventObject<PointerEvent>) => {
    clearCursorCoordinate();
    if (!pointerPanRef.current) {
      return;
    }

    pointerPanRef.current = undefined;
    event.target.getStage()?.container().style.setProperty('cursor', 'default');
    commitTransientPanView();
  };

  const handleMapClick = () => {
    const position = getNormalizedPointer();
    if (!position || readOnly) {
      return;
    }

    if (tool === 'place-player' && selectedPlayerId) {
      addPlayerMarker(selectedPlayerId, position);
      setTool('select');
      return;
    }

    if (tool === 'draw-route') {
      addRoutePoint(position);
      return;
    }

    if (tool === 'place-objective') {
      addObjective(selectedObjectiveType, position);
      return;
    }

    if (tool === 'place-zone') {
      addZone([
        { x: Math.max(position.x - 0.04, 0), y: Math.max(position.y - 0.03, 0) },
        { x: Math.min(position.x + 0.04, 1), y: Math.max(position.y - 0.03, 0) },
        { x: Math.min(position.x + 0.04, 1), y: Math.min(position.y + 0.03, 1) },
        { x: Math.max(position.x - 0.04, 0), y: Math.min(position.y + 0.03, 1) },
      ]);
      setTool('select');
      return;
    }

    if (tool === 'note') {
      addNote(position);
      setTool('select');
    }
  };

  const getNormalizedPointer = (): Coordinate | undefined => {
    const stage = stageRef.current;
    const group = groupRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !group || !pointer) {
      return undefined;
    }

    const transform = group.getAbsoluteTransform().copy().invert();
    return normalize(transform.point(pointer));
  };

  const markerScale = overlayScaleForView(view.scale);

  return (
    <section className={`board-shell ${presentationMode ? 'is-presentation' : ''}`}>
      {presentationMode || hideToolbar ? null : <BoardToolbar
        tool={tool}
        briefingMode={briefingMode}
        selectedObjectiveType={selectedObjectiveType}
        visibleLayers={layerVisibility}
        visibleObjectiveCategories={visibleObjectiveCategories}
        hasSelection={hasSelection}
        onToolChange={setTool}
        onLayerToggle={toggleLayer}
        onObjectiveCategoryToggle={toggleObjectiveCategory}
        onObjectiveTypeChange={onObjectiveTypeChange}
        onRemoveSelected={removeSelected}
        onCompleteRoute={completeRoute}
        onLoadObjectivePreset={replaceActiveObjectivesWithPreset}
        onExportObjectiveCoordinates={() => {
          const payload = {
            version: 1,
            planTitle: plan.title,
            phaseId: activePhase?.id,
            phaseName: activePhase?.name,
            map: mapSize,
            objectives: activePhase?.objectives ?? [],
          };
          downloadTextFile(
            `${plan.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-objective-coordinates.json`,
            JSON.stringify(payload, null, 2),
          );
        }}
        onExportPng={() => {
          const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
          if (dataUrl) {
            downloadDataUrl(`${plan.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-board.png`, dataUrl);
          }
        }}
      />}

      <div className="board-stage-wrap" ref={wrapperRef} data-testid="board-stage">
        {hideToolbar && !presentationMode ? (
          <div className="focus-tool-palette" aria-label="Focus board tools">
            <button
              type="button"
              className={`icon-button ${tool === 'select' ? 'is-active' : ''}`}
              title="Select / Pan"
              aria-label="Select / Pan"
              onClick={() => setTool('select')}
            >
              <MousePointer2 size={17} />
            </button>
            <button
              type="button"
              className={`icon-button ${tool === 'place-player' ? 'is-active' : ''}`}
              disabled={briefingMode}
              title="Place Player"
              aria-label="Place Player"
              onClick={() => setTool('place-player')}
            >
              <CircleDot size={17} />
            </button>
            <button
              type="button"
              className={`icon-button ${tool === 'draw-route' ? 'is-active' : ''}`}
              disabled={briefingMode}
              title="Draw Route"
              aria-label="Draw Route"
              onClick={() => setTool('draw-route')}
            >
              <Route size={17} />
            </button>
            <button
              type="button"
              className={`icon-button ${tool === 'place-objective' ? 'is-active' : ''}`}
              disabled={briefingMode}
              title="Place Objective"
              aria-label="Place Objective"
              onClick={() => setTool('place-objective')}
            >
              <Flag size={17} />
            </button>
            <button
              type="button"
              className={`icon-button ${tool === 'note' ? 'is-active' : ''}`}
              disabled={briefingMode}
              title="Add Note"
              aria-label="Add Note"
              onClick={() => setTool('note')}
            >
              <FileText size={17} />
            </button>
            <button
              type="button"
              className={`icon-button ${tool === 'remove' ? 'is-active' : ''}`}
              disabled={briefingMode}
              title={hasSelection ? 'Remove Selected' : 'Remove Tool'}
              aria-label={hasSelection ? 'Remove Selected' : 'Remove Tool'}
              onClick={() => {
                if (hasSelection) {
                  removeSelected();
                  return;
                }

                setTool(tool === 'remove' ? 'select' : 'remove');
              }}
            >
              <Eraser size={17} />
            </button>
            <select
              className="focus-objective-select"
              value={selectedObjectiveType}
              disabled={briefingMode}
              onChange={(event) => onObjectiveTypeChange(event.target.value as ObjectiveType)}
              title="Objective type"
              aria-label="Objective type"
            >
              {Object.entries(objectiveLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {tool === 'draw-route' ? (
              <button type="button" className="text-action focus-finish-route" onClick={completeRoute}>
                Finish
              </button>
            ) : null}
          </div>
        ) : null}
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerLeave}
        >
          <Layer>
            <Group
              ref={groupRef}
              x={view.x}
              y={view.y}
              scaleX={view.scale}
              scaleY={view.scale}
              draggable={false}
              onClick={handleMapClick}
              onTap={handleMapClick}
            >
              {mapImage ? (
                <Image
                  name="map"
                  image={mapImage}
                  width={mapSize.width}
                  height={mapSize.height}
                  opacity={0.88}
                  listening={false}
                />
              ) : (
                <Rect width={mapSize.width} height={mapSize.height} fill="#6f7374" listening={false} />
              )}

              {layerVisibility.zones
                ? activePhase?.zones.map((zone) => (
                    <Line
                      key={zone.id}
                      points={routePoints(zone.points)}
                      closed
                      fill={roleConfigs[zone.role].color}
                      opacity={zone.opacity}
                      stroke={roleConfigs[zone.role].color}
                      strokeWidth={2 * markerScale}
                    />
                  ))
                : null}

              {layerVisibility.routes
                ? activePhase?.routes.map((route) => (
                    <RouteLine
                      key={route.id}
                      route={route}
                      markerScale={markerScale}
                      selected={!presentationMode && route.id === selectedRouteId}
                      onSelect={() => {
                        if (presentationMode) {
                          return;
                        }
                        if (tool === 'remove') {
                          removeRoute(route.id);
                          return;
                        }

                        selectRoute(route.id);
                      }}
                    />
                  ))
                : null}

              {!presentationMode && layerVisibility.routes && selectedRoute?.points.length === 1 ? (
                <RouteDraftPoint route={selectedRoute} markerScale={markerScale} />
              ) : null}

              {layerVisibility.objectives
                ? activePhase?.objectives
                    .filter((objective) => visibleObjectiveCategories[getObjectiveCategory(objective.type)])
                    .map((objective) => (
                      <ObjectiveSprite
                        key={objective.id}
                        objective={objective}
                        markerScale={markerScale}
                        selected={!presentationMode && objective.id === selectedObjectiveId}
                        briefingMode={readOnly}
                        onSelect={() => {
                          if (presentationMode) {
                            return;
                          }
                          if (tool === 'remove') {
                            removeObjective(objective.id);
                            return;
                          }

                          selectObjective(objective.id);
                        }}
                        onMove={(position) => moveObjective(objective.id, position)}
                      />
                    ))
                : null}

              {layerVisibility.notes
                ? activePhase?.notes.map((note) => {
                    const point = denormalize(note.position);
                    return (
                      <Group
                        key={note.id}
                        x={point.x}
                        y={point.y}
                        scaleX={markerScale}
                        scaleY={markerScale}
                        onClick={(event) => {
                          event.cancelBubble = true;
                          if (presentationMode) {
                            return;
                          }
                          if (tool === 'remove') {
                            removeNote(note.id);
                            return;
                          }

                          selectNote(note.id);
                        }}
                      >
                        <Rect width={180} height={56} fill="#101418" opacity={0.84} stroke="#c9a866" cornerRadius={4} />
                        <Text text={note.text} x={10} y={9} width={160} height={40} fill="#f2ead7" fontSize={12} />
                      </Group>
                    );
                  })
                : null}

              {layerVisibility.players
                ? activePhase?.playerMarkers.map((marker) => {
                    const player = playerById.get(marker.playerId);
                    if (!player) {
                      return null;
                    }

                    return (
                      <PlayerDot
                        key={marker.id}
                        marker={marker}
                        player={player}
                      markerScale={markerScale}
                      reduceEffects={reduceCanvasEffects}
                      selected={!presentationMode && player.id === selectedPlayerId}
                        briefingMode={readOnly}
                        onSelect={() => {
                          if (presentationMode) {
                            return;
                          }
                          if (tool === 'remove') {
                            removePlayerMarker(player.id);
                            return;
                          }

                          selectPlayer(player.id);
                        }}
                        onMove={(position) => movePlayerMarker(marker.id, position)}
                        onHover={(next) => setHoveredMarker(next ? { marker, player } : undefined)}
                        onRemove={() => {
                          if (presentationMode) {
                            return;
                          }
                          removePlayerMarker(player.id);
                        }}
                      />
                    );
                  })
                : null}

              {hoveredMarker ? <MarkerTooltip hovered={hoveredMarker} markerScale={markerScale} /> : null}
            </Group>
          </Layer>
        </Stage>
        {presentationMode ? null : <div className="board-help">
          <span>Wheel zoom</span>
          <span>Alt/Shift + wheel pan</span>
          <span>V/P/R/O/N/E tools</span>
          <span>
            {tool === 'draw-route'
              ? selectedRoute?.points.length === 1
                ? 'Route start set; click next point'
                : 'Click map to set route start'
              : tool === 'remove'
                ? 'Click an object to remove it'
                : 'Select a player to inspect details'}
          </span>
          {cursorCoordinate ? (
            <span>
              X {cursorCoordinate.x.toFixed(3)} / Y {cursorCoordinate.y.toFixed(3)}
            </span>
          ) : null}
        </div>}
      </div>
    </section>
  );
});

type PlayerDotProps = {
  marker: PlayerMarker;
  player: Player;
  markerScale: number;
  reduceEffects: boolean;
  selected: boolean;
  briefingMode: boolean;
  onSelect: () => void;
  onMove: (position: Coordinate) => void;
  onHover: (hovered: boolean) => void;
  onRemove: () => void;
};

function PlayerDot({ marker, player, markerScale, reduceEffects, selected, briefingMode, onSelect, onMove, onHover, onRemove }: PlayerDotProps) {
  const point = denormalize(marker.position);
  const color = roleConfigs[player.role].color;
  const label = player.alias || player.ign.slice(0, 2).toUpperCase();

  return (
    <Group
      x={point.x}
      y={point.y}
      scaleX={markerScale}
      scaleY={markerScale}
      draggable={!briefingMode}
      onDragStart={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        onMove(normalize({ x: event.target.x(), y: event.target.y() }));
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onMouseEnter={(event) => {
        event.target.getStage()?.container().style.setProperty('cursor', briefingMode ? 'pointer' : 'grab');
        onHover(true);
      }}
      onMouseLeave={(event) => {
        event.target.getStage()?.container().style.setProperty('cursor', 'default');
        onHover(false);
      }}
      onDblClick={(event) => {
        event.cancelBubble = true;
        onRemove();
      }}
    >
      <Circle radius={selected ? 18 : 15} fill="#050607" opacity={0.86} stroke={selected ? '#f3d48a' : '#101418'} strokeWidth={2} />
      <Circle
        radius={11}
        fill={color}
        opacity={0.96}
        shadowColor={reduceEffects ? undefined : color}
        shadowBlur={reduceEffects ? 0 : selected ? 14 : 6}
      />
      <Text text={label} x={-18} y={17} width={36} align="center" fill="#f9f1df" fontSize={9} fontStyle="bold" />
      {marker.priority === 'high' ? <Circle radius={20} stroke="#f3d48a" strokeWidth={1.4} dash={[4, 4]} /> : null}
    </Group>
  );
}

type RouteLineProps = {
  route: RouteModel;
  markerScale: number;
  selected: boolean;
  onSelect: () => void;
};

function RouteLine({ route, markerScale, selected, onSelect }: RouteLineProps) {
  if (route.points.length < 2) {
    return null;
  }

  const color = roleConfigs[route.role].color;
  return (
    <Arrow
      points={routePoints(route.points)}
      stroke={color}
      fill={color}
      strokeWidth={(selected ? 6 : 4) * markerScale}
      pointerLength={18 * markerScale}
      pointerWidth={14 * markerScale}
      opacity={selected ? 1 : 0.76}
      dash={route.style === 'dashed' ? [18 * markerScale, 12 * markerScale] : undefined}
      lineCap="round"
      lineJoin="round"
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
    />
  );
}

function RouteDraftPoint({ route, markerScale }: { route: RouteModel; markerScale: number }) {
  const point = denormalize(route.points[0]);
  const color = roleConfigs[route.role].color;

  return (
    <Group x={point.x} y={point.y} scaleX={markerScale} scaleY={markerScale}>
      <Circle radius={14} fill="#050607" opacity={0.9} stroke="#f3d48a" strokeWidth={2} dash={[4, 4]} />
      <Circle radius={6} fill={color} shadowColor={color} shadowBlur={10} />
      <Label x={16} y={-26}>
        <Tag fill="#080b0d" opacity={0.92} stroke="#d9b66f" strokeWidth={1} cornerRadius={4} />
        <Text text="Route start" padding={6} fill="#fff4dc" fontSize={11} fontStyle="bold" />
      </Label>
    </Group>
  );
}

type ObjectiveSpriteProps = {
  objective: ObjectiveMarker;
  markerScale: number;
  selected: boolean;
  briefingMode: boolean;
  onSelect: () => void;
  onMove: (position: Coordinate) => void;
};

function ObjectiveSprite({ objective, markerScale, selected, briefingMode, onSelect, onMove }: ObjectiveSpriteProps) {
  const image = useImageElement(objectiveAssets[objective.type]);
  const [hovered, setHovered] = useState(false);
  const point = denormalize(objective.position);
  const size = objectiveVisualSize(objective.type);
  const showLabel = selected || hovered;

  return (
    <Group
      x={point.x}
      y={point.y}
      scaleX={markerScale}
      scaleY={markerScale}
      draggable={!briefingMode}
      onDragStart={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        event.cancelBubble = true;
        onMove(normalize({ x: event.target.x(), y: event.target.y() }));
      }}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect();
      }}
      onMouseEnter={(event) => {
        event.target.getStage()?.container().style.setProperty('cursor', briefingMode ? 'pointer' : 'grab');
        setHovered(true);
      }}
      onMouseLeave={(event) => {
        event.target.getStage()?.container().style.setProperty('cursor', 'default');
        setHovered(false);
      }}
    >
      <Circle
        radius={selected ? size * 0.68 : size * 0.56}
        fill="#0a0d0f"
        opacity={objective.type === 'red-farm' ? 0.42 : 0.72}
        stroke={selected ? '#f3d48a' : objective.type === 'red-farm' ? '#ff7b68' : '#9b7b42'}
        strokeWidth={objective.type === 'red-farm' ? 1 : 1.5}
      />
      {image ? <Image image={image} x={-size / 2} y={-size / 2} width={size} height={size} /> : null}
      {showLabel ? (
        <Label x={-58} y={size * 0.58}>
          <Tag fill="#080b0d" opacity={0.9} stroke="#d9b66f" strokeWidth={1} cornerRadius={4} />
          <Text text={objective.label} width={116} align="center" padding={6} fill="#fff4dc" fontSize={11} fontStyle="bold" />
        </Label>
      ) : null}
    </Group>
  );
}

function objectiveVisualSize(type: ObjectiveType): number {
  if (type === 'red-farm') {
    return 24;
  }
  if (type.includes('goose') || type.includes('tree')) {
    return 34;
  }
  return 42;
}

function MarkerTooltip({ hovered, markerScale }: { hovered: HoveredMarker; markerScale: number }) {
  const point = denormalize(hovered.marker.position);
  const lines = [
    hovered.player.ign,
    hovered.player.role,
    hovered.player.party ? `Party ${hovered.player.party}` : '',
    hovered.marker.task ?? 'No phase task',
  ].filter(Boolean);

  return (
    <Label x={point.x + 18 * markerScale} y={point.y - 58 * markerScale} scaleX={markerScale} scaleY={markerScale}>
      <Tag fill="#080b0d" opacity={0.92} stroke="#d9b66f" strokeWidth={1} cornerRadius={4} pointerDirection="down" pointerWidth={10} pointerHeight={8} />
      <Text text={lines.join('\n')} padding={8} fill="#f7eedb" fontSize={12} lineHeight={1.2} />
    </Label>
  );
}

function clampViewScale(scale: number): number {
  return Math.min(Math.max(scale, 0.06), 0.7);
}

function getTouchPair(touches: TouchList, container?: HTMLDivElement | null) {
  if (!container || touches.length < 2) {
    return undefined;
  }

  const rect = container.getBoundingClientRect();
  const first = {
    x: touches[0].clientX - rect.left,
    y: touches[0].clientY - rect.top,
  };
  const second = {
    x: touches[1].clientX - rect.left,
    y: touches[1].clientY - rect.top,
  };
  const dx = first.x - second.x;
  const dy = first.y - second.y;

  return {
    distance: Math.hypot(dx, dy),
    midpoint: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
  };
}

function getTouchPoint(touch: Touch, container: HTMLDivElement): Coordinate {
  const rect = container.getBoundingClientRect();
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
}

function isBoardBackgroundTarget(target: Konva.Node, stage?: Konva.Stage | null, group?: Konva.Group | null): boolean {
  return target === stage || target === group;
}

function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}
