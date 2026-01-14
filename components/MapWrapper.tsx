
import React, { useEffect, useRef } from 'react';
import { Veiculo, Profile } from '../types';

declare const L: any;

interface MapWrapperProps {
  vehicles: Veiculo[];
  drivers?: Profile[];
}

const MapWrapper: React.FC<MapWrapperProps> = ({ vehicles, drivers = [] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>({});
  const driverMarkersRef = useRef<any>({});

  // Ícones customizados
  const iconCar = L.icon({
      iconUrl: 'https://img.icons8.com/emoji/48/automobile-emoji.png',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
  });

  const iconTow = L.icon({
    iconUrl: 'https://img.icons8.com/color/96/tow-truck.png',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
  });

  const iconDriverTruck = L.icon({
    iconUrl: 'https://img.icons8.com/color/96/tow-truck.png',
    iconSize: [50, 50],
    iconAnchor: [25, 50],
  });

  useEffect(() => {
    if (mapContainer.current && !mapRef.current) {
      mapRef.current = L.map(mapContainer.current, { zoomControl: false }).setView([-23.5505, -46.6333], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Atualiza Veículos
    vehicles.forEach((vehicle) => {
      if (vehicle.lat && vehicle.lng) {
        const id = `v-${vehicle.id}`;
        const marker = markersRef.current[id];
        const currentIcon = vehicle.status === 'em_transito' ? iconTow : iconCar;

        if (marker) {
          marker.setLatLng([vehicle.lat, vehicle.lng]);
        } else {
          markersRef.current[id] = L.marker([vehicle.lat, vehicle.lng], { icon: currentIcon })
            .addTo(mapRef.current)
            .bindPopup(`<b class="text-xs">${vehicle.placa}</b>`);
        }
      }
    });

    // Atualiza Motoristas
    drivers.forEach((driver) => {
      if (driver.lat && driver.lng) {
        const id = `d-${driver.id}`;
        const marker = driverMarkersRef.current[id];
        const firstName = driver.full_name.split(' ')[0].toUpperCase();

        if (marker) {
          marker.setLatLng([driver.lat, driver.lng]);
          marker.setTooltipContent(firstName);
        } else {
          const newMarker = L.marker([driver.lat, driver.lng], { 
              icon: iconDriverTruck,
              zIndexOffset: 5000 
          })
          .addTo(mapRef.current)
          .bindTooltip(firstName, {
              permanent: true,
              direction: 'top',
              className: 'driver-label-tooltip',
              offset: [0, -45]
          });
          
          driverMarkersRef.current[id] = newMarker;

          // Se for o primeiro marcador e o mapa estiver longe, centraliza
          if (Object.keys(driverMarkersRef.current).length === 1) {
             mapRef.current.setView([driver.lat, driver.lng], 14);
          }
        }
      }
    });

    // Limpeza
    const currentVehicleIds = new Set(vehicles.map(v => `v-${v.id}`));
    Object.keys(markersRef.current).forEach(id => {
      if (!currentVehicleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    const currentDriverIds = new Set(drivers.map(d => `d-${d.id}`));
    Object.keys(driverMarkersRef.current).forEach(id => {
      if (!currentDriverIds.has(id)) {
        driverMarkersRef.current[id].remove();
        delete driverMarkersRef.current[id];
      }
    });

  }, [vehicles, drivers]);

  return <div ref={mapContainer} className="h-full w-full" />;
};

export default MapWrapper;
