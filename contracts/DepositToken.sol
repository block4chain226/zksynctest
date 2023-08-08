// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract DepositToken is ERC20, Ownable {

    constructor() ERC20("DepositToken", "DPT"){}

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}