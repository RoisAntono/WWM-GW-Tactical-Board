import { CircleDot, Crosshair, Download, Eraser, Eye, EyeOff, FileText, Flag, LocateFixed, MapPinned, MousePointer2, Route } from 'lucide-react';
import type { ReactNode } from 'react';
import { objectiveCategoryLabels, objectiveLabels } from '../../shared/constants';
import type { LayerKey, ObjectiveCategory, ObjectiveCategoryVisibility, ObjectiveType, ToolMode } from '../../types/domain';

type BoardToolbarProps = {
  tool: ToolMode;
  selectedObjectiveType: ObjectiveType;
  visibleLayers: Record<LayerKey, boolean>;
  visibleObjectiveCategories: ObjectiveCategoryVisibility;
  hasSelection: boolean;
  onToolChange: (tool: ToolMode) => void;
  onLayerToggle: (layer: LayerKey) => void;
  onObjectiveCategoryToggle: (category: ObjectiveCategory) => void;
  onObjectiveTypeChange: (type: ObjectiveType) => void;
  onRemoveSelected: () => void;
  onCompleteRoute: () => void;
  onLoadObjectivePreset: () => void;
  onExportObjectiveCoordinates: () => void;
  onExportPng: () => void;
};

const layerLabels: Array<{ key: LayerKey; label: string }> = [
  { key: 'players', label: 'Players' },
  { key: 'routes', label: 'Routes' },
  { key: 'objectives', label: 'Objectives' },
  { key: 'zones', label: 'Zones' },
  { key: 'notes', label: 'Notes' },
];

export function BoardToolbar({
  tool,
  selectedObjectiveType,
  visibleLayers,
  visibleObjectiveCategories,
  hasSelection,
  onToolChange,
  onLayerToggle,
  onObjectiveCategoryToggle,
  onObjectiveTypeChange,
  onRemoveSelected,
  onCompleteRoute,
  onLoadObjectivePreset,
  onExportObjectiveCoordinates,
  onExportPng,
}: BoardToolbarProps) {
  return (
    <div className="board-toolbar" aria-label="Board tools">
      <div className="tool-cluster">
        <IconButton active={tool === 'select'} label="Select / Pan (V)" onClick={() => onToolChange('select')}>
          <MousePointer2 size={17} />
        </IconButton>
        <IconButton
          active={tool === 'place-player'}
          label="Place Player (P)"
          onClick={() => onToolChange('place-player')}
        >
          <CircleDot size={17} />
        </IconButton>
        <IconButton
          active={tool === 'draw-route'}
          label="Draw Route (R)"
          onClick={() => onToolChange('draw-route')}
        >
          <Route size={17} />
        </IconButton>
        <IconButton
          active={tool === 'place-objective'}
          label="Place Objective (O)"
          onClick={() => onToolChange('place-objective')}
        >
          <Flag size={17} />
        </IconButton>
        <IconButton active={tool === 'note'} label="Add Note (N)" onClick={() => onToolChange('note')}>
          <FileText size={17} />
        </IconButton>
        <IconButton
          active={tool === 'remove'}
          label={hasSelection ? 'Remove Selected (Delete)' : 'Remove Tool (E)'}
          onClick={() => {
            if (hasSelection) {
              onRemoveSelected();
              return;
            }

            onToolChange(tool === 'remove' ? 'select' : 'remove');
          }}
        >
          <Eraser size={17} />
        </IconButton>
      </div>

      <select
        className="objective-select"
        value={selectedObjectiveType}
        onChange={(event) => onObjectiveTypeChange(event.target.value as ObjectiveType)}
        title="Objective type"
      >
        {Object.entries(objectiveLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {tool === 'draw-route' ? (
        <button className="text-action" onClick={onCompleteRoute}>
          Finish Route
        </button>
      ) : null}

      <button className="text-action" onClick={onLoadObjectivePreset} title="Reload calibrated objective coordinates">
        <LocateFixed size={15} />
        Objective Preset
      </button>

      <button className="text-action" onClick={onExportObjectiveCoordinates} title="Export active objective coordinates">
        <Crosshair size={15} />
        Export Coords
      </button>

      <div className="objective-filter-toggles">
        {(Object.keys(objectiveCategoryLabels) as ObjectiveCategory[]).map((category) => (
          <button
            key={category}
            className={`layer-toggle ${visibleObjectiveCategories[category] ? 'is-visible' : ''}`}
            onClick={() => onObjectiveCategoryToggle(category)}
            title={`${visibleObjectiveCategories[category] ? 'Hide' : 'Show'} ${objectiveCategoryLabels[category]}`}
          >
            {visibleObjectiveCategories[category] ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{objectiveCategoryLabels[category]}</span>
          </button>
        ))}
      </div>

      <div className="layer-toggles">
        {layerLabels.map((layer) => (
          <button
            key={layer.key}
            className={`layer-toggle ${visibleLayers[layer.key] ? 'is-visible' : ''}`}
            onClick={() => onLayerToggle(layer.key)}
            title={`${visibleLayers[layer.key] ? 'Hide' : 'Show'} ${layer.label}`}
          >
            {visibleLayers[layer.key] ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{layer.label}</span>
          </button>
        ))}
      </div>

      <IconButton label="Export Map PNG" onClick={onExportPng}>
        <Download size={17} />
      </IconButton>
      <MapPinned className="toolbar-brand-mark" size={18} />
    </div>
  );
}

type IconButtonProps = {
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
  onClick: () => void;
};

function IconButton({ active = false, disabled = false, label, children, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'is-active' : ''}`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
