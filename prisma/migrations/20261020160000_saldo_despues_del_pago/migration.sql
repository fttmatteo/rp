-- Saldo del cliente justo después de cada pago, para el recibo. Los pagos anteriores quedan en NULL.
ALTER TABLE "Pago" ADD COLUMN "saldoDespues" INTEGER;
