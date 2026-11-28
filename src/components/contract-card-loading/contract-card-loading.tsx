// Removed unused React import - React 17+ JSX transform doesn't require it
import { contract_stages } from '@/constants/contract-stage';
import { localize } from '@deriv-com/translations';
import ContractCardRunningBot from './contract-card-running-bot';

type TContractCardLoader = {
    speed?: number;
    contract_stage?: number;
};

const ContractCardLoader = ({ contract_stage }: TContractCardLoader) => (
    <>
        {contract_stage === contract_stages.RUNNING ? (
            <ContractCardRunningBot />
        ) : (
            <div data-testid='contract-card-loader'>
                <ContractCardRunningBot message={localize('Waiting for contract details.')} />
            </div>
        )}
    </>
);

export default ContractCardLoader;
