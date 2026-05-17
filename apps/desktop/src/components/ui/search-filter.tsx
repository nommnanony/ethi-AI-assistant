import { useState, useMemo } from 'react';
import { Input } from './input';
import { cn } from '../../lib/utils';
import { Search, X, Filter } from 'lucide-react';
import { Button } from './button';

export interface FilterOption {
  value: string;
  label: string;
}

export interface SearchFilterProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  filters?: {
    label: string;
    options: FilterOption[];
    value: string | null;
    onChange: (value: string | null) => void;
  }[];
  onSearch?: () => void;
  className?: string;
}

export function SearchFilter({
  placeholder = 'Search...',
  value,
  onChange,
  filters = [],
  onSearch,
  className,
}: SearchFilterProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const hasActiveFilters = useMemo(
    () => filters.some((f) => f.value !== null),
    [filters]
  );

  const handleSearch = () => {
    onChange(localValue);
    onSearch?.();
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    filters.forEach((f) => f.onChange(null));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={placeholder}
            leftIcon={<Search className="w-4 h-4" />}
            className="pr-20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {localValue && (
              <button
                onClick={handleClear}
                className="p-1 rounded hover:bg-surface-hover text-text-muted"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {onSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSearch}
                className="h-7 px-2"
              >
                Search
              </Button>
            )}
          </div>
        </div>

        {filters.length > 0 && (
          <Button
            variant={showFilters || hasActiveFilters ? 'primary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter className="w-4 h-4" />}
          >
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent-cyan/20 rounded-full">
                {filters.filter((f) => f.value).length}
              </span>
            )}
          </Button>
        )}
      </div>

      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-3 bg-surface-elevated rounded-lg border border-border">
          {filters.map((filter) => (
            <div key={filter.label} className="flex items-center gap-2">
              <span className="text-sm text-text-muted">{filter.label}:</span>
              <select
                value={filter.value || ''}
                onChange={(e) => filter.onChange(e.target.value || null)}
                className="px-2 py-1 bg-background border border-border rounded text-sm text-text-primary"
              >
                <option value="">All</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
