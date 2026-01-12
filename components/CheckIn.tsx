
import React from 'react';

const CheckIn: React.FC = () => {
  return (
    <div className="p-8 h-full">
      <h1 className="text-3xl font-bold text-white mb-6">Check-in de Veículos</h1>
      <div className="bg-gray-800 p-6 rounded-lg">
        <p className="text-gray-400">
            A funcionalidade para operadores confirmarem a chegada de um veículo no pátio, registrando a entrada e mudando o status para "No Pátio", será construída aqui.
        </p>
      </div>
    </div>
  );
};

export default CheckIn;
