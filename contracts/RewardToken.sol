// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RewardToken is ERC20, Ownable {
    constructor() ERC20("RewardToken", "RWT"){
        _mint(owner(), 10000000e18);
    }

    function mint(address _account, uint256 _amount) external onlyOwner {
        _mint(_account, _amount);
    }
}