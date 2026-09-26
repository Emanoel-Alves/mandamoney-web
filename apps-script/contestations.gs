function getDisputes(userId) {
  return response({
    success: true,
    disputes: readDisputesForUser(userId),
  });
}

function contestNotifications(userId) {
  const notifications = readDisputesForUser(userId)
    .filter((dispute) =>
      dispute.creditorId === String(userId) &&
      dispute.status.toLowerCase() === 'pendente'
    )
    .map((dispute) => ({ ...dispute, type: 'contest_request' }));

  return response({ success: true, notifications });
}

function getBalanceItems(balanceId, userId) {
  const normalizedBalanceId = String(balanceId || '').trim();
  const normalizedUserId = String(userId || '').trim();
  const file = SpreadsheetApp.openById(SHEET_ID);
  const balancesSheet = file.getSheetByName('Saldos');
  const balanceRows = balancesSheet.getDataRange().getValues();
  const balance = balanceRows.find((row, index) =>
    index > 0 &&
    String(row[0]).trim() === normalizedBalanceId &&
    (String(row[1]).trim() === normalizedUserId || String(row[2]).trim() === normalizedUserId)
  );

  if (!balance) throw new Error('Saldo não encontrado para este usuário.');

  const linksSheet = getBalanceItemsSheet(file);
  const itemSheet = file.getSheetByName('Compras_Itens');
  const links = linksSheet.getDataRange().getValues();
  const itemRows = itemSheet.getDataRange().getValues();
  const itemsById = {};

  itemRows.slice(1).forEach((row) => {
    itemsById[String(row[0])] = row;
  });

  const items = links.slice(1)
    .filter((row) =>
      String(row[0]).trim() === normalizedBalanceId &&
      String(row[2]).trim() === String(balance[1]).trim() &&
      String(row[3]).trim() === String(balance[2]).trim()
    )
    .map((row) => {
      const item = itemsById[String(row[1])];
      return {
        itemId: String(row[1]),
        value: Number(row[4]) || 0,
        product: item ? String(item[3] || '') : '',
        date: item ? item[1] : '',
        market: item ? String(item[2] || '') : '',
      };
    });

  return response({ success: true, items });
}

function readDisputesForUser(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) throw new Error('Informe o usuário das contestações.');

  const file = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getContestationsSheet(file);
  const rows = sheet.getDataRange().getValues();
  const itemsSheet = file.getSheetByName('Compras_Itens');
  const itemRows = itemsSheet.getDataRange().getValues();
  const productsById = {};

  itemRows.slice(1).forEach((row) => {
    productsById[String(row[0])] = String(row[3] || '');
  });

  return rows.slice(1)
    .filter((row) =>
      String(row[3]) === normalizedUserId ||
      String(row[4]) === normalizedUserId
    )
    .map((row) => ({
      id: String(row[0]),
      balanceId: String(row[1]),
      itemId: String(row[2]),
      debtorId: String(row[3]),
      creditorId: String(row[4]),
      value: Number(row[5]) || 0,
      status: String(row[6] || 'Pendente'),
      requestedAt: row[7] || '',
      resolvedAt: row[8] || '',
      product: productsById[String(row[2])] || '',
    }));
}

function requestContest(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const file = SpreadsheetApp.openById(SHEET_ID);
    const itemsSheet = file.getSheetByName('Compras_Itens');
    const balancesSheet = file.getSheetByName('Saldos');
    const disputesSheet = getContestationsSheet(file);
    const linksSheet = getBalanceItemsSheet(file);
    const itemId = String(data.itemId || '').trim();
    const balanceId = String(data.balanceId || '').trim();
    const debtorId = String(data.debtorId || '').trim();
    const creditorId = String(data.creditorId || '').trim();
    if (!itemId) throw new Error('O item não foi informado.');

    const balances = balancesSheet.getDataRange().getValues();
    const balanceIndex = balances.findIndex((row, index) =>
      index > 0 &&
      String(row[0]).trim() === balanceId &&
      String(row[1]).trim() === debtorId &&
      String(row[2]).trim() === creditorId
    );

    if (balanceIndex === -1) throw new Error('Saldo não encontrado.');
    if (String(balances[balanceIndex][4]).trim().toLowerCase() !== 'pendente') {
      throw new Error('Só é possível contestar um saldo pendente.');
    }

    const links = linksSheet.getDataRange().getValues();
    const linkIndex = links.findIndex((row, index) =>
      index > 0 &&
      String(row[0]).trim() === balanceId &&
      String(row[1]).trim() === itemId &&
      String(row[2]).trim() === debtorId &&
      String(row[3]).trim() === creditorId
    );
    if (linkIndex === -1) throw new Error('Este item não faz parte do saldo selecionado.');

    const disputes = disputesSheet.getDataRange().getValues();
    const hasExistingDispute = disputes.slice(1).some((row) =>
      String(row[1]).trim() === balanceId &&
      String(row[2]).trim() === itemId
    );
    if (hasExistingDispute) throw new Error('Este item já possui uma contestação registrada.');

    const share = Number(links[linkIndex][4]);
    const balanceValue = Number(balances[balanceIndex][3]);
    if (!Number.isFinite(share) || share <= 0 || balanceValue < share) {
      throw new Error('O valor deste item não corresponde mais ao saldo pendente.');
    }

    const disputeId = Utilities.getUuid();
    disputesSheet.appendRow([
      disputeId,
      balanceId,
      itemId,
      debtorId,
      creditorId,
      share,
      'Pendente',
      new Date(),
      '',
    ]);
    balancesSheet.getRange(balanceIndex + 1, 5).setValue('Contestação pendente');

    return response({
      success: true,
      message: 'Contestação enviada.',
      disputeId,
    });
  } finally {
    lock.releaseLock();
  }
}

function resolveContest(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const notificationId = String(data.notificationId || '').trim();
    const creditorId = String(data.creditorId || '').trim();
    const decision = String(data.decision || '').trim();
    if (!['accepted', 'rejected'].includes(decision)) {
      throw new Error('Resposta de contestação inválida.');
    }

    const file = SpreadsheetApp.openById(SHEET_ID);
    const disputesSheet = getContestationsSheet(file);
    const balancesSheet = file.getSheetByName('Saldos');
    const disputes = disputesSheet.getDataRange().getValues();
    const disputeIndex = disputes.findIndex((row, index) =>
      index > 0 &&
      String(row[0]).trim() === notificationId &&
      String(row[4]).trim() === creditorId &&
      String(row[6]).trim().toLowerCase() === 'pendente'
    );

    if (disputeIndex === -1) {
      throw new Error('Contestação não encontrada ou já respondida.');
    }

    const dispute = disputes[disputeIndex];
    const balances = balancesSheet.getDataRange().getValues();
    const balanceIndex = balances.findIndex((row, index) =>
      index > 0 &&
      String(row[0]).trim() === String(dispute[1]).trim() &&
      String(row[1]).trim() === String(dispute[3]).trim() &&
      String(row[2]).trim() === creditorId
    );

    if (balanceIndex === -1) throw new Error('Saldo relacionado à contestação não foi encontrado.');
    if (String(balances[balanceIndex][4]).trim().toLowerCase() !== 'contestação pendente') {
      throw new Error('O saldo não está aguardando resposta à contestação.');
    }

    if (decision === 'accepted') {
      const currentValue = Number(balances[balanceIndex][3]);
      const disputedValue = Number(dispute[5]);
      if (currentValue < disputedValue) throw new Error('O saldo já não contém o valor contestado.');

      const remainingValue = Math.max(0, Math.round((currentValue - disputedValue) * 100000000) / 100000000);
      balancesSheet.getRange(balanceIndex + 1, 4).setValue(remainingValue);
      balancesSheet.getRange(balanceIndex + 1, 5).setValue(
        remainingValue === 0 ? 'Contestado' : 'Pendente'
      );
    } else {
      balancesSheet.getRange(balanceIndex + 1, 5).setValue('Pendente');
    }

    disputesSheet.getRange(disputeIndex + 1, 7)
      .setValue(decision === 'accepted' ? 'Aceita' : 'Recusada');
    disputesSheet.getRange(disputeIndex + 1, 9).setValue(new Date());

    return response({
      success: true,
      message: decision === 'accepted'
        ? 'Contestação aceita; valor removido do saldo.'
        : 'Contestação recusada; valor mantido no saldo.',
    });
  } finally {
    lock.releaseLock();
  }
}

function getContestationsSheet(file) {
  let sheet = file.getSheetByName('Contestacoes');
  if (!sheet) {
    sheet = file.insertSheet('Contestacoes');
    sheet.appendRow([
      'ID',
      'Saldo_ID',
      'Item_ID',
      'Devedor_ID',
      'Credor_ID',
      'Valor',
      'Status',
      'Data_Solicitacao',
      'Data_Resolucao',
    ]);
  }
  return sheet;
}

function getBalanceItemsSheet(file) {
  let sheet = file.getSheetByName('Saldo_Itens');
  if (!sheet) {
    sheet = file.insertSheet('Saldo_Itens');
    sheet.appendRow([
      'Saldo_ID',
      'Item_ID',
      'Devedor_ID',
      'Credor_ID',
      'Valor',
    ]);
  }
  return sheet;
}

function recordBalanceItem(file, balanceId, itemId, debtorId, creditorId, value) {
  getBalanceItemsSheet(file).appendRow([
    String(balanceId),
    String(itemId),
    String(debtorId),
    String(creditorId),
    Number(value),
  ]);
}

function backfillBalanceItems() {
  const file = SpreadsheetApp.openById(SHEET_ID);
  const linksSheet = getBalanceItemsSheet(file);
  const existingLinks = linksSheet.getDataRange().getValues();
  if (existingLinks.length > 1) {
    throw new Error('Saldo_Itens já contém dados. A migração inicial só pode ser executada em uma aba vazia.');
  }

  const balancesSheet = file.getSheetByName('Saldos');
  const itemsSheet = file.getSheetByName('Compras_Itens');
  const balanceRows = balancesSheet.getDataRange().getValues();
  const itemRows = itemsSheet.getDataRange().getValues();
  const queuesByPair = {};
  const linksToWrite = [];

  balanceRows.slice(1).forEach((row) => {
    const debtorId = String(row[1]).trim();
    const creditorId = String(row[2]).trim();
    const pair = `${debtorId}-${creditorId}`;
    if (!queuesByPair[pair]) queuesByPair[pair] = [];
    queuesByPair[pair].push({
      id: String(row[0]),
      debtorId,
      creditorId,
      remaining: Number(row[3]) || 0,
    });
  });

  itemRows.slice(1).forEach((item) => {
    const itemId = String(item[0]).trim();
    const buyerId = String(item[6]).trim();
    const participants = String(item[7] || '').split('|').filter(Boolean);
    const paidWith = String(item[8] || '').split('|').filter(Boolean);
    const share = Number(item[5]) / Math.max(participants.length, 1);

    participants
      .filter((debtorId) => debtorId !== buyerId && !paidWith.includes(debtorId))
      .forEach((debtorId) => {
        let remainingShare = share;
        const pair = `${debtorId}-${buyerId}`;
        const queue = queuesByPair[pair] || [];

        while (remainingShare > 0.0000001) {
          const balance = queue.find((entry) => entry.remaining > 0.0000001);
          if (!balance) {
            throw new Error(`Não foi possível relacionar o item ${itemId} ao saldo ${pair}.`);
          }

          const linkedValue = Math.min(remainingShare, balance.remaining);
          linksToWrite.push([
            balance.id,
            itemId,
            debtorId,
            buyerId,
            linkedValue,
          ]);
          balance.remaining -= linkedValue;
          remainingShare -= linkedValue;
        }
      });
  });

  if (linksToWrite.length) {
    linksSheet.getRange(2, 1, linksToWrite.length, 5).setValues(linksToWrite);
  }

  return 'Migração de itens dos saldos concluída.';
}
