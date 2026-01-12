
import React, { useEffect, useRef } from 'react';
import { Veiculo } from '../types';

declare const L: any; // Using Leaflet from CDN

interface MapWrapperProps {
  vehicles: Veiculo[];
}

const MapWrapper: React.FC<MapWrapperProps> = ({ vehicles }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>({});

  const iconTow = L.icon({
    iconUrl: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
    iconSize: [50, 50],
    iconAnchor: [25, 50],
    popupAnchor: [0, -50],
  });

  const iconCar = L.icon({
      iconUrl: 'https://img.icons8.com/emoji/48/automobile-emoji.png',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
  });

  useEffect(() => {
    if (mapContainer.current && !mapRef.current) {
      mapRef.current = L.map(mapContainer.current).setView([-14.235, -51.925], 4); // Center of Brazil

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Update or create markers
    vehicles.forEach((vehicle) => {
      if (vehicle.lat && vehicle.lng) {
        const marker = markersRef.current[vehicle.id];
        const isTowTruck = vehicle.status === 'em_transito';
        const currentIcon = isTowTruck ? iconTow : iconCar;

        const popupContent = `
          <div class="space-y-1 text-sm text-gray-800">
            <div class="font-bold text-base mb-2">Placa: <span class="font-mono bg-gray-200 text-gray-900 px-2 py-0.5 rounded-md">${vehicle.placa}</span></div>
            <div class="border-t border-gray-200 pt-2 mt-2 space-y-1">
                <div><strong>Modelo:</strong> ${vehicle.modelo || 'N/A'}</div>
                <div><strong>Cor:</strong> ${vehicle.cor || 'N/A'}</div>
                <div><strong>Proprietário:</strong> ${vehicle.proprietario_nome || 'N/A'}</div>
                <div class="mt-1"><strong>Status:</strong> <span class="font-semibold">${vehicle.status}</span></div>
                ${isTowTruck && vehicle.profiles ? `<div><strong>Motorista:</strong> ${vehicle.profiles.full_name}</div>` : ''}
            </div>
          </div>
        `;

        if (marker) {
          marker.setLatLng([vehicle.lat, vehicle.lng]);
          marker.setIcon(currentIcon);
          marker.getPopup().setContent(popupContent);
        } else {
          const newMarker = L.marker([vehicle.lat, vehicle.lng], { icon: currentIcon })
            .addTo(mapRef.current)
            .bindPopup(popupContent);
          markersRef.current[vehicle.id] = newMarker;
        }
      }
    });

    // Remove markers for vehicles no longer in the list
    const vehicleIds = new Set(vehicles.map(v => v.id));
    Object.keys(markersRef.current).forEach(markerId => {
      if (!vehicleIds.has(markerId)) {
        markersRef.current[markerId].remove();
        delete markersRef.current[markerId];
      }
    });

  }, [vehicles, iconTow, iconCar]);

  return <div ref={mapContainer} className="h-full w-full" />;
};

export default MapWrapper;
