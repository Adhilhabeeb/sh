import React from 'react';
import { Star, MessageSquarePlus, Sparkles, ArrowRight } from 'lucide-react';

export interface GarmentItem {
  id: string;
  name: string;
  category: string;
  price: number;
  tag: string;
  fabric: string;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  colors: string[];
}

export const FEATURED_GARMENTS: GarmentItem[] = [
  {
    id: 'hoodie-01',
    name: 'Oversized Heavyweight Hoodie',
    category: 'Sweatshirts & Fleece',
    price: 140,
    tag: 'Best Seller',
    fabric: '480 GSM French Terry Cotton',
    rating: 4.9,
    reviewCount: 38,
    imageUrl:
      'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
    colors: ['Oatmeal', 'Charcoal', 'Sage'],
  },
  {
    id: 'shirt-02',
    name: 'Pleated Linen Camp Collar Shirt',
    category: 'Shirts & Tops',
    price: 115,
    tag: 'New Drop',
    fabric: '100% Pre-Washed Belgian Linen',
    rating: 4.8,
    reviewCount: 24,
    imageUrl:
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    colors: ['Bone', 'Sand', 'Olive'],
  },
  {
    id: 'trouser-03',
    name: 'Tailored Straight-Leg Trousers',
    category: 'Pants & Tailoring',
    price: 175,
    tag: 'Core Essential',
    fabric: 'Wool Blend with Gentle Stretch',
    rating: 5.0,
    reviewCount: 19,
    imageUrl:
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80',
    colors: ['Espresso', 'Charcoal', 'Navy'],
  },
  {
    id: 'jacket-04',
    name: 'Structured Denim Trucker Jacket',
    category: 'Outerwear',
    price: 210,
    tag: 'Limited Edition',
    fabric: '14oz Japanese Selvedge Denim',
    rating: 4.9,
    reviewCount: 29,
    imageUrl:
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
    colors: ['Washed Indigo', 'Raw Black'],
  },
  {
    id: 'tee-05',
    name: 'Minimalist Boxy Heavy Tee',
    category: 'T-Shirts',
    price: 65,
    tag: 'Essential Staple',
    fabric: '280 GSM Ringspun Combed Cotton',
    rating: 4.7,
    reviewCount: 52,
    imageUrl:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    colors: ['Chalk White', 'Washed Black', 'Heather'],
  },
  {
    id: 'coat-06',
    name: 'Relaxed Wool Trench Overcoat',
    category: 'Outerwear',
    price: 340,
    tag: 'Winter Atelier',
    fabric: 'Double-Faced Melton Wool',
    rating: 5.0,
    reviewCount: 16,
    imageUrl:
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
    colors: ['Camel', 'Midnight Black'],
  },
];

interface ClothingCatalogProps {
  onSelectGarmentForReview: (garmentName: string) => void;
}

export const ClothingCatalog: React.FC<ClothingCatalogProps> = ({
  onSelectGarmentForReview,
}) => {
  return (
    <section id="collection" className="scroll-mt-24 space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-5">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Autumn / Winter 2026 Collection</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 font-display">
            Featured Apparel &amp; Client Favorites
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Architectural tailoring, heavyweight organic textiles, and relaxed everyday cuts. Browse pieces and leave a verified fit review below.
          </p>
        </div>

        <a
          href="#review"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-900 hover:text-stone-600 transition-colors shrink-0 group"
        >
          <span>Share Custom Review</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </a>
      </div>

      {/* Garments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {FEATURED_GARMENTS.map((item) => (
          <article
            key={item.id}
            className="group flex flex-col bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-stone-400 hover:shadow-md transition-all duration-300"
          >
            {/* Image Container with Badge */}
            <div className="relative aspect-[4/5] bg-stone-100 overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.name}
                loading="lazy"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              />
              <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-stone-900/90 text-white backdrop-blur-xs shadow-xs">
                {item.tag}
              </span>
              <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-white/90 text-[11px] font-medium text-stone-800 shadow-xs">
                ${item.price}
              </span>
            </div>

            {/* Product Details */}
            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>{item.category}</span>
                  <div className="flex items-center gap-1 text-amber-600 font-medium">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span className="text-stone-800">{item.rating}</span>
                    <span className="text-stone-400">({item.reviewCount})</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-stone-900 font-display group-hover:text-stone-700 transition-colors">
                  {item.name}
                </h3>

                <p className="text-xs text-stone-500 line-clamp-1">{item.fabric}</p>

                {/* Color swatches pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-stone-400">Colors:</span>
                  {item.colors.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded text-[10px] bg-stone-100 text-stone-700 border border-stone-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => onSelectGarmentForReview(item.name)}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-stone-900 bg-stone-100 hover:bg-stone-900 hover:text-white border border-stone-300 hover:border-stone-900 transition-colors cursor-pointer group/btn"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>Review This Garment</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
