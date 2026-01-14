
import React, { useEffect, useRef } from 'react';
import { Veiculo, Profile } from '../types';

declare const L: any; // Using Leaflet from CDN

interface MapWrapperProps {
  vehicles: Veiculo[];
  drivers?: Profile[];
}

const MapWrapper: React.FC<MapWrapperProps> = ({ vehicles, drivers = [] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>({});
  const driverMarkersRef = useRef<any>({});

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

  const iconDriver = L.icon({
    iconUrl: 'https://img.icons8.com/color/96/000000/worker.png', // Ícone de motorista
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

  useEffect(() => {
    if (mapContainer.current && !mapRef.current) {
      mapRef.current = L.map(mapContainer.current).setView([-14.235, -51.925], 4);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Atualiza Veículos
    vehicles.forEach((vehicle) => {
      if (vehicle.lat && vehicle.lng) {
        const marker = markersRef.current[vehicle.id];
        const isTowTruck = vehicle.status === 'em_transito';
        const currentIcon = isTowTruck ? iconTow : iconCar;

        const popupContent = `
          <div class="space-y-1 text-sm text-gray-800">
            <div class="font-bold text-base mb-2">Veículo: <span class="font-mono bg-gray-200 text-gray-900 px-2 py-0.5 rounded-md">${vehicle.placa}</span></div>
            <div><strong>Modelo:</strong> ${vehicle.modelo || 'N/A'}</div>
            <div><strong>Status:</strong> ${vehicle.status}</div>
          </div>
        `;

        if (marker) {
          marker.setLatLng([vehicle.lat, vehicle.lng]);
          marker.setIcon(currentIcon);
          marker.getPopup().setContent(popupContent);
        } else {
          markersRef.current[vehicle.id] = L.marker([vehicle.lat, vehicle.lng], { icon: currentIcon })
            .addTo(mapRef.current)
            .bindPopup(popupContent);
        }
      }
    });

    // Atualiza Motoristas
    drivers.forEach((driver) => {
      if (driver.lat && driver.lng) {
        const marker = driverMarkersRef.current[driver.id];
        const popupContent = `
          <div class="text-sm p-1">
            <div class="font-black uppercase tracking-tighter text-blue-600">${driver.full_name}</div>
            <div class="text-[9px] text-gray-500 font-bold uppercase">Motorista Logado</div>
            <div class="mt-2 text-[10px] text-gray-400 italic">Visto em: ${driver.last_seen ? new Date(driver.last_seen).toLocaleTimeString() : '---'}</div>
          </div>
        `;

        if (marker) {
          marker.setLatLng([driver.lat, driver.lng]);
          marker.getPopup().setContent(popupContent);
        } else {
          driverMarkersRef.current[driver.id] = L.marker([driver.lat, driver.lng], { icon: iconDriver })
            .addTo(mapRef.current)
            .bindPopup(popupContent);
        }
      }
    });

    // Cleanup Veículos
    const vehicleIds = new Set(vehicles.map(v => v.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!vehicleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Cleanup Motoristas
    const driverIds = new Set(drivers.map(d => d.id));
    Object.keys(driverMarkersRef.current).forEach(id => {
      if (!driverIds.has(id)) {
        driverMarkersRef.current[id].remove();
        delete driverMarkersRef.current[id];
      }
    });

  }, [vehicles, drivers]);

  return <div ref={mapContainer} className="h-full w-full" />;
};

export default MapWrapper;
