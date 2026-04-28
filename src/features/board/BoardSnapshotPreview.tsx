import { useEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Group, Image, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva';
import { defaultObjectiveCategoryVisibility, getObjectiveCategory, objectiveAssets, roleConfigs } from '../../shared/constants';
import type { ObjectiveMarker, ObjectiveType, Phase, Player, TacticalPlan } from '../../types/domain';
import { denormalize, mapSize, overlayScaleForView, routePoints } from './boardMath';
import { useImageElement } from './useImageElement';
import { useResizeObserver } from './useResizeObserver';
import { assets } from '../../shared/assets';

type BoardSnapshotPreviewProps = {
  plan: TacticalPlan;
  activePhaseId: string;
};

export function BoardSnapshotPreview({ plan, activePhaseId }: BoardSnapshotPreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const size = useResizeObserver(wrapperRef);
  const mapImage = useImageElement(assets.map, assets.mapFallback);
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.16 });
  const activePhase = useMemo(() => getActivePhase(plan, activePhaseId), [activePhaseId, plan]);
  const playerById = useMemo(() => new Map(plan.roster.map((player) => [player.id, player] as const)), [plan.roster]);

  useEffect(() => {
    if (!size.width || !size.height) {
      return;
    }

    const scale = Math.min(size.width / mapSize.width, size.height / mapSize.height) * 0.98;
    setView({
      scale,
      x: (size.width - mapSize.width * scale) / 2,
      y: (size.height - mapSize.height * scale) / 2,
    });
  }, [size.height, size.width]);

  const markerScale = overlayScaleForView(view.scale);

  return (
    <div className="share-board-preview" ref={wrapperRef} data-testid="share-preview-stage">
      <Stage width={size.width} height={size.height} listening={false}>
        <Layer>
          <Group x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}>
            {mapImage ? (
              <Image image={mapImage} width={mapSize.width} height={mapSize.height} opacity={0.88} />
            ) : (
              <Rect width={mapSize.width} height={mapSize.height} fill="#6f7374" />
            )}

            {activePhase.zones.map((zone) => (
              <Line
                key={zone.id}
                points={routePoints(zone.points)}
                closed
                fill={roleConfigs[zone.role].color}
                opacity={zone.opacity}
                stroke={roleConfigs[zone.role].color}
                strokeWidth={2 * markerScale}
              />
            ))}

            {activePhase.routes.map((route) =>
              route.points.length >= 2 ? (
                <Arrow
                  key={route.id}
                  points={routePoints(route.points)}
                  stroke={roleConfigs[route.role].color}
                  fill={roleConfigs[route.role].color}
                  strokeWidth={4 * markerScale}
                  pointerLength={18 * markerScale}
                  pointerWidth={14 * markerScale}
                  opacity={0.76}
                  dash={route.style === 'dashed' ? [18 * markerScale, 12 * markerScale] : undefined}
                  lineCap="round"
                  lineJoin="round"
                />
              ) : null,
            )}

            {activePhase.objectives
              .filter((objective) => defaultObjectiveCategoryVisibility[getObjectiveCategory(objective.type)])
              .map((objective) => (
                <PreviewObjective key={objective.id} objective={objective} markerScale={markerScale} />
              ))}

            {activePhase.notes.map((note) => {
              const point = denormalize(note.position);
              return (
                <Group key={note.id} x={point.x} y={point.y} scaleX={markerScale} scaleY={markerScale}>
                  <Rect width={180} height={56} fill="#101418" opacity={0.84} stroke="#c9a866" cornerRadius={4} />
                  <Text text={note.text} x={10} y={9} width={160} height={40} fill="#f2ead7" fontSize={12} />
                </Group>
              );
            })}

            {activePhase.playerMarkers.map((marker) => {
              const player = playerById.get(marker.playerId);
              if (!player) {
                return null;
              }
              return <PreviewPlayer key={marker.id} player={player} phase={activePhase} markerId={marker.id} markerScale={markerScale} />;
            })}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}

function PreviewPlayer({ player, phase, markerId, markerScale }: { player: Player; phase: Phase; markerId: string; markerScale: number }) {
  const marker = phase.playerMarkers.find((item) => item.id === markerId);
  if (!marker) {
    return null;
  }

  const point = denormalize(marker.position);
  const color = roleConfigs[player.role].color;
  const label = player.alias || player.ign.slice(0, 2).toUpperCase();

  return (
    <Group x={point.x} y={point.y} scaleX={markerScale} scaleY={markerScale}>
      <Circle radius={15} fill="#050607" opacity={0.86} stroke="#101418" strokeWidth={2} />
      <Circle radius={11} fill={color} opacity={0.96} shadowColor={color} shadowBlur={6} />
      <Text text={label} x={-18} y={17} width={36} align="center" fill="#f9f1df" fontSize={9} fontStyle="bold" />
      {marker.priority === 'high' ? <Circle radius={20} stroke="#f3d48a" strokeWidth={1.4} dash={[4, 4]} /> : null}
    </Group>
  );
}

function PreviewObjective({ objective, markerScale }: { objective: ObjectiveMarker; markerScale: number }) {
  const image = useImageElement(objectiveAssets[objective.type]);
  const point = denormalize(objective.position);
  const size = objectiveVisualSize(objective.type);

  return (
    <Group x={point.x} y={point.y} scaleX={markerScale} scaleY={markerScale}>
      <Circle
        radius={size * 0.56}
        fill="#0a0d0f"
        opacity={objective.type === 'red-farm' ? 0.42 : 0.72}
        stroke={objective.type === 'red-farm' ? '#ff7b68' : '#9b7b42'}
        strokeWidth={objective.type === 'red-farm' ? 1 : 1.5}
      />
      {image ? <Image image={image} x={-size / 2} y={-size / 2} width={size} height={size} /> : null}
      <Label x={-58} y={size * 0.58} visible={false}>
        <Tag fill="#080b0d" opacity={0.9} stroke="#d9b66f" strokeWidth={1} cornerRadius={4} />
        <Text text={objective.label} width={116} align="center" padding={6} fill="#fff4dc" fontSize={11} fontStyle="bold" />
      </Label>
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

function getActivePhase(plan: TacticalPlan, activePhaseId: string): Phase {
  return plan.phases.find((phase) => phase.id === activePhaseId) ?? plan.phases[0];
}
