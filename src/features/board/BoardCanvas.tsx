import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Group, Image, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { usePlanStore } from '../../app/store';
import { assets } from '../../shared/assets';
import { defaultObjectiveCategoryVisibility, getObjectiveCategory, objectiveAssets, roleConfigs } from '../../shared/constants';
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
};

type HoveredMarker = {
  marker: PlayerMarker;
  player: Player;
};

export const BoardCanvas = forwardRef<BoardCanvasHandle, BoardCanvasProps>(function BoardCanvas(
  { selectedObjectiveType, onObjectiveTypeChange, presentationMode = false },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const groupRef = useRef<Konva.Group>(null);
  const size = useResizeObserver(wrapperRef);
  const mapImage = useImageElement(assets.map, assets.mapFallback);
  const [hoveredMarker, setHoveredMarker] = useState<HoveredMarker>();
  const [cursorCoordinate, setCursorCoordinate] = useState<Coordinate>();
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.16, fitted: false });

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
    const clampedScale = Math.min(Math.max(nextScale, 0.06), 0.7);
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
      {presentationMode ? null : <BoardToolbar
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
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onWheel={handleWheel}
          onMouseMove={() => setCursorCoordinate(getNormalizedPointer())}
          onMouseLeave={() => setCursorCoordinate(undefined)}
        >
          <Layer>
            <Group
              ref={groupRef}
              x={view.x}
              y={view.y}
              scaleX={view.scale}
              scaleY={view.scale}
              draggable={presentationMode || (tool === 'select' && !briefingMode)}
              onDragEnd={(event) =>
                setView((current) => ({ ...current, x: event.target.x(), y: event.target.y(), fitted: true }))
              }
            >
              {mapImage ? (
                <Image
                  name="map"
                  image={mapImage}
                  width={mapSize.width}
                  height={mapSize.height}
                  opacity={0.88}
                  onClick={handleMapClick}
                  onTap={handleMapClick}
                />
              ) : (
                <Rect width={mapSize.width} height={mapSize.height} fill="#6f7374" onClick={handleMapClick} />
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
  selected: boolean;
  briefingMode: boolean;
  onSelect: () => void;
  onMove: (position: Coordinate) => void;
  onHover: (hovered: boolean) => void;
  onRemove: () => void;
};

function PlayerDot({ marker, player, markerScale, selected, briefingMode, onSelect, onMove, onHover, onRemove }: PlayerDotProps) {
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
      <Circle radius={11} fill={color} opacity={0.96} shadowColor={color} shadowBlur={selected ? 14 : 6} />
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
