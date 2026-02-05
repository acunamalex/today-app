import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Stop } from '../../types';
import { StopCard } from './StopCard';

interface SortableStopProps {
  stop: Stop;
  index: number;
  onRemove?: (stopId: string) => void;
  onClick?: (stopId: string) => void;
  estimatedDuration?: number;
  estimatedDistance?: number;
}

function SortableStop({
  stop,
  index,
  onRemove,
  onClick,
  estimatedDuration,
  estimatedDistance,
}: SortableStopProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <StopCard
        stop={stop}
        index={index}
        isDragging={isDragging}
        estimatedDuration={estimatedDuration}
        estimatedDistance={estimatedDistance}
        onRemove={onRemove ? () => onRemove(stop.id) : undefined}
        onClick={onClick ? () => onClick(stop.id) : undefined}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export interface StopListProps {
  stops: Stop[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove?: (stopId: string) => void;
  onClick?: (stopId: string) => void;
  routeLegs?: { distance: number; duration: number }[];
}

export function StopList({
  stops,
  onReorder,
  onRemove,
  onClick,
  routeLegs,
}: StopListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stops.findIndex((s) => s.id === active.id);
      const newIndex = stops.findIndex((s) => s.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  if (stops.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={stops.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-3">
          {stops.map((stop, index) => (
            <SortableStop
              key={stop.id}
              stop={stop}
              index={index}
              onRemove={onRemove}
              onClick={onClick}
              estimatedDuration={routeLegs?.[index]?.duration}
              estimatedDistance={routeLegs?.[index]?.distance}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
