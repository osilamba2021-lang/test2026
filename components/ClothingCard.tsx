
import React from 'react';
import { ClothingItem } from '../types';

interface ClothingCardProps {
  item: ClothingItem;
  onRemove?: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const ClothingCard: React.FC<ClothingCardProps> = ({ item, onRemove, selected, onToggleSelect }) => {
  return (
    <div 
      className={`group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border-2 ${selected ? 'border-amber-400' : 'border-transparent'}`}
      onClick={() => onToggleSelect?.(item.id)}
    >
      <div className="aspect-[3/4] overflow-hidden bg-stone-100">
        <img 
          src={item.image} 
          alt={item.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full text-stone-600 hover:text-red-500 hover:bg-white transition-colors"
        >
          <i className="fa-solid fa-xmark text-xs"></i>
        </button>
      )}

      <div className="p-3">
        <span className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">{item.category}</span>
        <h3 className="text-sm font-medium text-stone-800 truncate">{item.name}</h3>
      </div>
    </div>
  );
};

export default ClothingCard;
