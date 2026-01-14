
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

  // Ícone para veículos aguardando coleta
  const iconCar = L.icon({
      iconUrl: 'https://img.icons8.com/emoji/48/automobile-emoji.png',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
  });

  // Ícone para veículos em trânsito (guincho com carro)
  const iconTow = L.icon({
    iconUrl: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
    iconSize: [50, 50],
    iconAnchor: [25, 50],
    popupAnchor: [0, -50],
  });

  // NOVO ÍCONE: Motorista Logado (Caminhão de Serviço)
  const iconDriverTruck = L.icon({
    iconUrl: 'https://img.icons8.com/color/96/tow-truck.png',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
  });

  useEffect(() => {
    if (mapContainer.current && !mapRef.current) {
      mapRef.current = L.map(mapContainer.current, {
          zoomControl: false 
      }).setView([-14.235, -51.925], 4);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapRef.current);
      
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Sincronizar Veículos (Aguardando Coleta / Em Trânsito)
    vehicles.forEach((vehicle) => {
      if (vehicle.lat && vehicle.lng) {
        const marker = markersRef.current[vehicle.id];
        const isTowTruck = vehicle.status === 'em_transito';
        const currentIcon = isTowTruck ? iconTow : iconCar;

        const popupContent = `
          <div class="p-2 min-w-[120px]">
            <div class="text-[10px] font-black uppercase text-gray-500 mb-1">Veículo</div>
            <div class="font-mono bg-black text-white px-2 py-0.5 rounded text-lg text-center mb-2 font-black italic border border-gray-700">${vehicle.placa}</div>
            <div class="text-[10px] font-bold text-gray-800 uppercase">${vehicle.modelo || 'S/ MODELO'}</div>
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

    // Sincronizar Motoristas Online (Com ícone de caminhão e nome flutuante)
    drivers.forEach((driver) => {
      if (driver.lat && driver.lng) {
        const marker = driverMarkersRef.current[driver.id];
        
        // Conteúdo do Popup (ao clicar)
        const popupContent = `
          <div class="p-2">
            <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-xs">${driver.full_name.charAt(0)}</div>
                <div>
                    <div class="text-[10px] font-black uppercase text-blue-600 tracking-tighter">Motorista Ativo</div>
                    <div class="text-xs font-bold text-gray-900">${driver.full_name}</div>
                </div>
            </div>
            <div class="text-[8px] text-gray-400 font-bold uppercase border-t pt-1">
                Última atualização: ${new Date(driver.last_seen!).toLocaleTimeString()}
            </div>
          </div>
        `;

        // Nome Curto para o rótulo flutuante
        const firstName = driver.full_name.split(' ')[0].toUpperCase();

        if (marker) {
          marker.setLatLng([driver.lat, driver.lng]);
          marker.getPopup().setContent(popupContent);
          // Atualiza o texto do rótulo flutuante (tooltip)
          marker.setTooltipContent(firstName);
        } else {
          // Cria o marcador com ícone de caminhão
          const newMarker = L.marker([driver.lat, driver.lng], { 
              icon: iconDriverTruck,
              zIndexOffset: 2000 // Sempre acima de tudo no mapa
          })
          .addTo(mapRef.current)
          .bindPopup(popupContent);
          
          // Adiciona o rótulo permanente com o primeiro nome
          newMarker.bindTooltip(firstName, {
              permanent: true,
              direction: 'top',
              className: 'driver-label-tooltip',
              offset: [0, -45] // Ajusta para ficar logo acima do caminhão
          }).openTooltip();

          driverMarkersRef.current[driver.id] = newMarker;
          
          // Se for o primeiro motorista a aparecer, centraliza o mapa nele
          if (Object.keys(driverMarkersRef.current).length === 1 && mapRef.current.getZoom() < 10) {
              mapRef.current.setView([driver.lat, driver.lng], 14);
          }
        }
      }
    });

    // Remover Veículos que saíram da lista (ex: finalizados)
    const vehicleIds = new Set(vehicles.map(v => v.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!vehicleIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Remover Motoristas que ficaram offline
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
