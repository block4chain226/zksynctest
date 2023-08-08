// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

contract Farm is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Position {
        uint256 amount;
        uint256 startDate;
    }

    IERC20 public rewardToken;
    IERC20 public depositToken;

    uint256 public accRewardPerSecond = 10;
    uint256 public constant PRECISION_FACTOR = 1e18;
    uint256 public totalStaked;
    uint256 public totalRewardsPaid;

    mapping(address => Position) public positions;

    constructor(address _rewardToken, address _depositToken){
        rewardToken = IERC20(_rewardToken);
        depositToken = IERC20(_depositToken);
    }

    event Stake(address indexed user, uint256 amount, uint256 indexed startDate);
    event Claim(address indexed user, uint256 amount, uint256 indexed date);
    event UnStake(address indexed user, uint256 amount, uint256 indexed date);
    event SetAccRewardPerSecond(uint256 oldAmount, uint256 newAmount, uint256 indexed date);
    event SetFee(uint256 oldFee, uint256 newFee, uint256 indexed date);
    event DepositRewardToken(uint256 amount, uint256 indexed date);

    function stake(uint256 _amount) external nonReentrant {
        require(depositToken.balanceOf(msg.sender) >= _amount, "you don't have enough tokens");
        Position storage newPosition = positions[msg.sender];
        if (newPosition.amount > 0) {
            claim();
        }
        newPosition.startDate = block.timestamp;
        newPosition.amount += _amount;
        totalStaked += _amount;
        depositToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Stake(msg.sender, _amount, newPosition.startDate);
    }

    function unStake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "amount 0");
        require(depositToken.balanceOf(address(this)) >= _amount, "contract hasn't enough tokens");
        Position storage userPosition = positions[msg.sender];
        require(userPosition.amount >= _amount, "you have not enough position amount");
        claim();
        userPosition.amount -= _amount;
        totalStaked -= _amount;
        depositToken.safeTransfer(msg.sender, _amount);
        emit UnStake(msg.sender, _amount, block.timestamp);
    }

    function claim() public {
        Position storage userPosition = positions[msg.sender];
        require(userPosition.amount > 0, "user don't stake");
        require(block.timestamp > userPosition.startDate, "time error");
        uint256 stakeTime = block.timestamp - userPosition.startDate;
        uint256 claimAmount = (userPosition.amount * stakeTime * accRewardPerSecond) / PRECISION_FACTOR;
        require(claimAmount > 0, "user have not rewards");
        require(rewardToken.balanceOf(address(this)) >= claimAmount, "contract has not enough reward tokens");
        totalRewardsPaid += claimAmount;
        userPosition.startDate = block.timestamp;
        rewardToken.safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, claimAmount, block.timestamp);
    }

    function getPendingRewards(address _account) external view returns (uint256) {
        require(_account != address(0), "zero account");
        Position memory userPosition = positions[_account];
        require(userPosition.amount > 0, "user don't stake");
        uint256 stakeTime = block.timestamp - userPosition.startDate;
        return (userPosition.amount * stakeTime * accRewardPerSecond) / PRECISION_FACTOR;
    }

    function getUserStakedAmount(address _account) external view returns (uint256) {
        require(_account != address(0), "zero account");
        Position memory userPosition = positions[_account];
        return userPosition.amount;
    }

    function depositRewardToken(uint256 _amount) external onlyOwner {
        require(_amount > 0, "amount 0");
        require(rewardToken.balanceOf(owner()) >= _amount, "you have not enough reward tokens");
        require(rewardToken.allowance(msg.sender, address(this)) >= _amount, "you haven't enough allowance");
        rewardToken.safeTransferFrom(owner(), address(this), _amount);
        emit DepositRewardToken(_amount, block.timestamp);
    }

    function setAccRewardPerSecond(uint256 _newAmount) external onlyOwner {
        require(_newAmount > 0, "accRewardPerShare can't be 0");
        uint256 oldAmount = accRewardPerSecond;
        accRewardPerSecond = _newAmount;
        emit SetAccRewardPerSecond(oldAmount, _newAmount, block.timestamp);
    }
}