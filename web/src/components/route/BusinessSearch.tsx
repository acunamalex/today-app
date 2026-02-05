import { useState } from 'react';
import { Search, MapPin, Plus, Loader2, Building2, Phone, Globe, Clock, Tag } from 'lucide-react';
import { Button, Modal, Card, Select, Input } from '../common';
import {
  searchBusinesses,
  getBusinessCategories,
  formatBusinessDistance,
  type BusinessResult,
  type BusinessCategory,
} from '../../services/businessSearchService';
import type { Coordinates } from '../../types';

export interface BusinessSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onAddStop: (address: string, name: string, coordinates: Coordinates) => void;
  userLocation?: Coordinates | null;
}

export function BusinessSearch({
  isOpen,
  onClose,
  onAddStop,
  userLocation,
}: BusinessSearchProps) {
  const [category, setCategory] = useState<BusinessCategory>('all');
  const [keyword, setKeyword] = useState('');
  const [radius, setRadius] = useState(8046); // 5 mi default
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!userLocation) {
      setError('Location not available. Please enable location access.');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const businesses = await searchBusinesses({
        center: userLocation,
        radius,
        category,
        keyword: keyword.trim() || undefined,
        limit: 50,
      });

      setResults(businesses);

      if (businesses.length === 0) {
        const msg = keyword.trim()
          ? `No businesses matching "${keyword}" found. Try a different keyword or larger radius.`
          : 'No businesses found in this area. Try a larger radius or different category.';
        setError(msg);
      }
    } catch (err) {
      setError('Failed to search for businesses. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userLocation && !isSearching) {
      handleSearch();
    }
  };

  const handleAddBusiness = (business: BusinessResult) => {
    onAddStop(business.address, business.name, business.coordinates);
    setAddedIds((prev) => new Set([...prev, business.id]));
  };

  const categories = getBusinessCategories();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find Nearby Businesses" size="lg">
      <div className="space-y-4">
        {/* Keyword Search */}
        <div>
          <Input
            label="Search by name or keyword"
            placeholder="e.g., Starbucks, Pizza, Pharmacy..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyPress}
            leftIcon={<Tag className="w-4 h-4" />}
          />
          <p className="text-xs text-slate-500 mt-1">
            Leave empty to search all businesses in category
          </p>
        </div>

        {/* Search Controls */}
        <div className="flex gap-3">
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BusinessCategory)}
            options={categories}
            fullWidth={false}
            className="flex-1"
          />
          <Select
            label="Radius"
            value={radius.toString()}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            options={[
              { value: '1609', label: '1 mi' },
              { value: '3218', label: '2 mi' },
              { value: '8046', label: '5 mi' },
              { value: '16093', label: '10 mi' },
              { value: '40233', label: '25 mi' },
            ]}
            fullWidth={false}
            className="w-32"
          />
          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              disabled={!userLocation || isSearching}
              isLoading={isSearching}
              leftIcon={<Search className="w-4 h-4" />}
            >
              Search
            </Button>
          </div>
        </div>

        {!userLocation && (
          <Card className="bg-warning-50 border-warning-200">
            <div className="flex items-center gap-2 text-warning-700">
              <MapPin className="w-5 h-5" />
              <p className="text-sm">
                Location access is required to find nearby businesses.
              </p>
            </div>
          </Card>
        )}

        {error && (
          <Card className="bg-danger-50 border-danger-200">
            <p className="text-sm text-danger-700">{error}</p>
          </Card>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-96 overflow-auto space-y-2">
            <p className="text-sm text-slate-500">
              Found {results.length} businesses
            </p>
            {results.map((business) => {
              const isAdded = addedIds.has(business.id);

              return (
                <Card
                  key={business.id}
                  className={`transition-colors ${
                    isAdded ? 'bg-success-50 border-success-200' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-slate-900">
                            {business.name}
                          </h4>
                          <p className="text-sm text-slate-500">{business.type}</p>
                        </div>
                        {business.distance && (
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {formatBusinessDistance(business.distance)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {business.address}
                      </p>
                      {(business.phone || business.website || business.openingHours) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                          {business.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {business.phone}
                            </span>
                          )}
                          {business.openingHours && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {business.openingHours}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant={isAdded ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => handleAddBusiness(business)}
                      disabled={isAdded}
                      leftIcon={isAdded ? null : <Plus className="w-4 h-4" />}
                    >
                      {isAdded ? 'Added' : 'Add'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isSearching && results.length === 0 && !error && (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500">
              Search for businesses near your location
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
